const isGLM53Flash = config => config?.provider === 'zhipu' && String(config.model || '').toLowerCase() === 'glm-5.3-flash';
// Verified against Z.AI GLM-5.3-Flash documentation, 2026-09-17.
// UTF-8 bytes are a conservative token upper bound, not an exact token count.
function summaryModelPolicy(config) {
 const large = isGLM53Flash(config);
 return { large, contextTokens: large ? 1000000 : null, maxOutput: large ? 131072 : Number.MAX_SAFE_INTEGER,
   inputBytes: large ? 800000 : null, reasoning: large ? 'high' : undefined };
}
module.exports = { isGLM53Flash, summaryModelPolicy };
