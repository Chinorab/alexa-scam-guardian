/**
 * Dataset checks (constitution Principle V): valid against the JSON Schema, every reference
 * resolves, every source is official, DOJ only backs help resources, every cue compiles.
 */
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../schema/pattern.schema.json" with { type: "json" };
import type { Dataset, Publisher } from "./types";

const HOSTS: Record<Publisher, RegExp> = {
  FTC: /(^|\.)ftc\.gov$/,
  FBI: /(^|\.)fbi\.gov$/,
  IC3: /(^|\.)ic3\.gov$/,
  DOJ: /(^|\.)(justice\.gov|ojp\.gov)$/,
};

export function checkDataset(data: unknown): string[] {
  const problems: string[] = [];
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats.default(ajv);
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    for (const error of validate.errors ?? []) {
      problems.push(`schema: ${error.instancePath || "/"} ${error.message ?? ""}`);
    }
    return problems;
  }

  const dataset = data as unknown as Dataset;
  const used = new Set<string>();
  const signIds = new Set(dataset.warningSigns.map((sign) => sign.id));

  const refs = (where: string, sourceRefs: string[], allowDoj = false) => {
    for (const ref of sourceRefs) {
      const source = dataset.sources[ref];
      used.add(ref);
      if (!source) problems.push(`${where}: unknown source "${ref}"`);
      else if (source.publisher === "DOJ" && !allowDoj)
        problems.push(`${where}: DOJ sources may only back help resources`);
    }
    if (!allowDoj && !sourceRefs.some((ref) => dataset.sources[ref]?.publisher !== "DOJ")) {
      problems.push(`${where}: needs at least one FTC, FBI or IC3 source`);
    }
  };

  for (const [id, source] of Object.entries(dataset.sources)) {
    const host = new URL(source.url).hostname;
    if (!HOSTS[source.publisher].test(host)) {
      problems.push(`source ${id}: ${host} is not an official ${source.publisher} domain`);
    }
  }

  for (const sign of dataset.warningSigns) {
    refs(`sign ${sign.id}`, sign.sourceRefs);
    for (const cue of sign.cues) {
      try {
        new RegExp(cue, "i");
      } catch {
        problems.push(`sign ${sign.id}: cue does not compile: ${cue}`);
      }
    }
  }

  for (const pattern of dataset.patterns) {
    refs(`pattern ${pattern.id}`, pattern.sourceRefs);
    for (const signId of pattern.signIds) {
      if (!signIds.has(signId)) problems.push(`pattern ${pattern.id}: unknown sign "${signId}"`);
    }
  }

  for (const [method, paid] of Object.entries(dataset.ifPaid))
    refs(`ifPaid ${method}`, paid.sourceRefs);
  for (const resource of dataset.resources)
    refs(`resource ${resource.id}`, resource.sourceRefs, true);

  for (const id of Object.keys(dataset.sources)) {
    if (!used.has(id)) problems.push(`source ${id}: never referenced`);
  }
  return problems;
}

/** Online check: every source URL answers. Run by hand, not in CI (sites may rate limit). */
export async function checkUrls(dataset: Dataset): Promise<string[]> {
  const problems: string[] = [];
  for (const [id, source] of Object.entries(dataset.sources)) {
    try {
      const response = await fetch(source.url, { method: "GET", redirect: "follow" });
      if (!response.ok) problems.push(`source ${id}: HTTP ${response.status} ${source.url}`);
    } catch (error) {
      problems.push(`source ${id}: unreachable ${source.url} (${String(error)})`);
    }
  }
  return problems;
}
