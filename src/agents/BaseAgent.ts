import { BaseModel } from '../models/BaseModel';
import { BaseSkill, SkillContext } from '../skills/BaseSkill';

export abstract class BaseAgent<M extends BaseModel = BaseModel> {
  readonly id: string;
  name?: string;
  role?: string;
  model: M;
  createdAt: Date;

  // Skills that this agent can use
  protected skills: BaseSkill[] = [];

  constructor(model: M, opts: { id?: string; name?: string; role?: string } = {}) {
    this.model = model;
    this.id = opts.id ?? `agent-${Date.now()}`;
    this.name = opts.name;
    this.role = opts.role;
    this.createdAt = new Date();
  }

  /** Register a skill with the agent */
  registerSkill(skill: BaseSkill) {
    this.skills.push(skill);
  }
  unregisterSkill(skill: BaseSkill) {
    this.skills = this.skills.filter(s => s.id !== skill.id);
  }

  /** Find a skill that can handle the input (first match) */
  async findSkillFor(input: string, ctx?: SkillContext): Promise<BaseSkill | undefined> {
    for (const s of this.skills) {
      const ok = await s.canHandle(input, ctx);
      if (ok) return s;
    }
    return undefined;
  }

  /** Run the matching skill if any */
  async runSkill(input: string, ctx: SkillContext = {}): Promise<any | undefined> {
    const skill = await this.findSkillFor(input, ctx);
    if (!skill) return undefined;
    return skill.run(input, { ...ctx, agentId: this.id, model: this.model });
  }

  /** Decide on a plan (e.g., build a prompt or pipeline) */
  abstract plan(input: any): Promise<any>;

  /** Execute the plan using the underlying model or other tools */
  abstract act(plan: any): Promise<any>;

  /** High-level convenience runner */
  async run(input: any): Promise<any> {
    // Skill-first: if a skill can handle the input, run it
    const skillResult = await this.runSkill(String(input));
    if (skillResult !== undefined) return skillResult;

    const plan = await this.plan(input);
    const result = await this.act(plan);
    return result;
  }
}
