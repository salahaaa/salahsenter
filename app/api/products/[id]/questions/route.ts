export const dynamic = "force-dynamic";

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, productAnswers, productQuestions, products, users } from "@/lib/db";
import { checkIpRateLimit } from "@/lib/rate-limit";

const questionSchema = z.object({ question: z.string().trim().min(5).max(1_000) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await context.params;
    const questions = await db
      .select({ question: productQuestions, userName: users.fullName })
      .from(productQuestions)
      .leftJoin(users, eq(productQuestions.userId, users.id))
      .where(and(eq(productQuestions.productId, productId), eq(productQuestions.isApproved, true)))
      .orderBy(asc(productQuestions.createdAt));
    const questionIds = questions.map((row) => row.question.id);
    const answers = questionIds.length
      ? await db.select({ answer: productAnswers, userName: users.fullName }).from(productAnswers).leftJoin(users, eq(productAnswers.userId, users.id)).where(and(eq(productAnswers.isApproved, true), inArray(productAnswers.questionId, questionIds))).orderBy(asc(productAnswers.createdAt))
      : [];
    const answersByQuestion = new Map<string, Array<{ id: string; answer: string; userName: string | null; createdAt: Date }>>();
    for (const row of answers) {
      const list = answersByQuestion.get(row.answer.questionId) || [];
      list.push({ id: row.answer.id, answer: row.answer.answer, userName: row.userName, createdAt: row.answer.createdAt });
      answersByQuestion.set(row.answer.questionId, list);
    }
    return ok({ questions: questions.map((row) => ({ id: row.question.id, question: row.question.question, userName: row.userName || "عميل", createdAt: row.question.createdAt, answers: answersByQuestion.get(row.question.id) || [] })) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل أسئلة المنتج");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkIpRateLimit("product:questions", 12, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقاً", 429);
    const { id: productId } = await context.params;
    const session = await requireAuth();
    const payload = questionSchema.parse(await request.json());
    const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.status, "active"))).limit(1);
    if (!product) return fail("المنتج غير متاح لطرح سؤال", 404);
    const [question] = await db.insert(productQuestions).values({ productId, userId: session.userId, question: payload.question, isApproved: false }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "product_question_submitted", entityId: question.id, afterData: { productId } });
    return created({ question: { id: question.id, question: question.question, pendingReview: true }, message: "تم إرسال سؤالك إلى المتجر للمراجعة والرد" });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال السؤال");
  }
}

