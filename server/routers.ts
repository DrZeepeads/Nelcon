import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chat: router({
    listConversations: protectedProcedure.query(({ ctx }) =>
      db.getConversations(ctx.user.id)
    ),

    createConversation: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          responseMode: z.enum(["concise", "academic"]).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createConversation(
          ctx.user.id,
          input.title,
          input.responseMode || "concise"
        )
      ),

    getConversation: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversation(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const messages = await db.getMessages(input.conversationId);
        return { conversation, messages };
      }),

    updateConversation: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          title: z.string().optional(),
          responseMode: z.enum(["concise", "academic"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversation(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.updateConversation(input.conversationId, {
          title: input.title,
          responseMode: input.responseMode,
        });
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversation(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteConversation(input.conversationId);
      }),

    sendMessage: protectedProcedure
      .input(
        z.object({
          conversationId: z.string(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversation(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const userMessage = await db.createMessage(
          input.conversationId,
          "user",
          input.content
        );

        await db.createAuditLog(
          ctx.user.id,
          "message_sent",
          input.conversationId,
          { messageLength: input.content.length }
        );

        return { userMessage };
      }),
  }),
});

export type AppRouter = typeof appRouter;

