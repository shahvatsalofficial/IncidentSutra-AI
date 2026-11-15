// Tiny JSON Schema subset validator (type, const, enum, pattern, required, properties, items).
// Enough to enforce this project's own contracts without a dependency. Not a general validator.
const typeOf = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

export function validate(schema, value, at = '$') {
  const errors = [];
  const walk = (s, v, p) => {
    if (s.const !== undefined && v !== s.const) errors.push(`${p}: expected constant ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(v)) errors.push(`${p}: not in enum`);
    if (s.type) {
      const t = typeOf(v), ok = s.type === 'number' ? t === 'number' : s.type === 'integer' ? Number.isInteger(v) : t === s.type;
      if (!ok) { errors.push(`${p}: expected ${s.type}, got ${t}`); return; }
    }
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) errors.push(`${p}: does not match ${s.pattern}`);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const r of s.required ?? []) if (!(r in v)) errors.push(`${p}: missing required "${r}"`);
      for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in v) walk(sub, v[k], `${p}.${k}`);
    }
    if (Array.isArray(v) && s.items) v.forEach((x, i) => walk(s.items, x, `${p}[${i}]`));
  };
  walk(schema, value, at);
  return {ok: errors.length === 0, errors: errors.slice(0, 50)};
}
