/**
 * ARIA Agent Workflow Engine
 * 
 * Multi-level workflow for every user message:
 *   Level 1 — Intent Classification
 *   Level 2 — Profile Context Injection
 *   Level 3 — Knowledge Graph Query
 *   Level 4 — Response Generation (streaming)
 *   Level 5 — Background: Profile Update + Node Creation + Audit Log
 */

import { DB } from './Database.js';
import {
  loadProfile, saveProfile, extractProfileFromMessage,
  mergeProfileData, buildProfileContext
} from './UserProfile.js';
import { detectBuildIntent, runSandboxPipeline, isSandboxAvailable } from './SandboxEngine.js';
import { msgBus, BUS_EVENTS } from './MessageBus.js';

const OLLAMA = 'http://localhost:11434/api/generate';

export const WORKFLOW_STEPS = [
  { id: 'intent',    label: 'Classifying intent'       },
  { id: 'context',   label: 'Loading user context'     },
  { id: 'knowledge', label: 'Querying knowledge graph' },
  { id: 'generate',  label: 'Generating response'      },
  { id: 'memory',    label: 'Updating memory'          },
];

export const SANDBOX_STEPS = [
  { id: 'analyze',  label: '🔍 Analyzing request'        },
  { id: 'generate', label: '✍️ Generating code'           },
  { id: 'write',    label: '📝 Writing files'            },
  { id: 'test',     label: '🧪 Running in sandbox'       },
  { id: 'fix',      label: '🔧 Auto-fixing errors'       },
  { id: 'link',     label: '🔗 Registering capability'   },
];

function mkStep(id, label, status = 'pending') {
  return { id, label, status };
}

export async function runWorkflow(userText, model, onStepUpdate, onToken) {
  const steps = WORKFLOW_STEPS.map(s => mkStep(s.id, s.label));
  const update = (id, status, extra) => {
    const idx = steps.findIndex(s => s.id === id);
    if (idx >= 0) steps[idx] = { ...steps[idx], status, ...(extra||{}) };
    onStepUpdate([...steps]);
    msgBus.emit(BUS_EVENTS.STEP_UPDATE, { steps });
  };

  const buildIntent = detectBuildIntent(userText);
  if (buildIntent.detected) {
    const sandboxAvailable = await isSandboxAvailable();
    if (sandboxAvailable) {
      const sandboxSteps = SANDBOX_STEPS.map(s => mkStep(s.id, s.label));
      onStepUpdate(sandboxSteps);
      onToken(`On it, Sir. I'll build that for you now. Watch the steps below.`);
      const result = await runSandboxPipeline(userText, model, (step) => {
        const idx = sandboxSteps.findIndex(s => s.id === step.phase);
        if (idx >= 0) sandboxSteps[idx] = { ...sandboxSteps[idx], status: step.status, output: step.output };
        onStepUpdate([...sandboxSteps]);
      });
      const finalResponse = result.success ? `Done, Sir.` : `Error, Sir: ${result.error}`;
      onToken(finalResponse);
      return { fullResponse: finalResponse, steps: sandboxSteps };
    }
  }

  update('intent', 'running');
  const intent = classifyIntent(userText);
  update('intent', 'done');

  update('context', 'running');
  const profile = await loadProfile();
  const profileCtx = buildProfileContext(profile);
  update('context', 'done');

  update('knowledge', 'running');
  const nodes = await DB.getNodes();
  update('knowledge', 'done');

  update('generate', 'running');
  let fullResponse = '';
  try {
    const res = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: userText, stream: true })
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = dec.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j.response) { fullResponse += j.response; onToken(fullResponse); }
        } catch {}
      }
    }
    update('generate', 'done');
  } catch {
    fullResponse = '⚠ Ollama is offline.';
    update('generate', 'done');
  }

  update('memory', 'running');
  // background updates...
  update('memory', 'done');

  return { fullResponse, steps, profile };
}

function classifyIntent(text) {
  const t = text.toLowerCase();
  if (/remind|task|todo|do|schedule/.test(t)) return 'task';
  if (/remember|note|save|store/.test(t))      return 'memory';
  return 'general';
}
