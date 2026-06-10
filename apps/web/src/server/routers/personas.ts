import { z } from "zod";

import {
  createPersona,
  deletePersona,
  listPersonas,
  PERSONA_TONES,
  setPersonaReference,
  updatePersona,
} from "../data/personas.js";
import { publicProcedure, router } from "../trpc.js";

const personaInput = z.object({
  name: z.string().min(1).max(64),
  niche: z.string().min(1).max(120),
  tone: z.enum(PERSONA_TONES),
  language: z.string().min(2).max(8),
  promptTemplate: z.string().min(1).max(1000),
});

export const personasRouter = router({
  list: publicProcedure.query(() => listPersonas()),
  create: publicProcedure.input(personaInput).mutation(({ input }) => createPersona(input)),
  update: publicProcedure
    .input(z.object({ id: z.string().min(1) }).and(personaInput))
    .mutation(({ input }) => updatePersona(input.id, input)),
  remove: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => deletePersona(input.id)),
  setReference: publicProcedure
    .input(z.object({ id: z.string().min(1), imageUrl: z.string().min(1).max(3_000_000) }))
    .mutation(({ input }) => setPersonaReference(input.id, input.imageUrl)),
});
