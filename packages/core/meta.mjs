import {readFileSync} from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export const TOOL = Object.freeze({
  name: 'IncidentSutra AI',
  cli: 'incidentsutra',
  version: pkg.version,
  ruleVersion: '2026.11-r2',
  creator: 'Vatsal Shah',
  license: 'Apache-2.0',
  homepage: 'https://github.com/shahvatsalofficial/IncidentSutra-AI'
});

export const REPORT_SCHEMA = 'incidentsutra.report.v2';
export const EVENT_SCHEMA = 'incidentsutra.event.v2';
export const LEGACY_REPORT_SCHEMAS = ['incidentsutra.report.v1'];
