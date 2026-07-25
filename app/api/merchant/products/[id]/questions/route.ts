export const dynamic = "force-dynamic";

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, productAnswers, productQuestions, products, users } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";

const actionSchema = z.object({
  questionId: z.string().uuid(),
  action: z.enum(["approve", "reject", "answer"]),
  answer: z.string().trim().min(3).max(2_000).optional()
}).superRefine((value, ctx) => {
  if (value.action === "answer" && !value.answer) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer"], message: "الرد مطلوب" });
});

async function assertMerchantProductAccess(userId: string, productId: string) {
  const [product] = await db.select({ id: products.id, storeId: products.storeId }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return { error: fail("المنتج غير موجود", 404) };
  const session = await requireAuth();
  if (!hasStoreAccess(session, product.storeId) || !(await userHasStoreOperation(userId, product.storeId, "products.edit"))) return { error: fail("لا تملك صلاحية إدارة أسئلة هذا المنتج", 403) };
  return { product, session };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await context.params;
    const session = await requireAuth();
    const access = await assertMerchantProductAccess(session.userId, productId);
    if (access.error) return access.error;
    const questions = await db.select({ question: productQuestions, userName: users.fullName }).from(productQuestions).leftJoin(users, eq(productQuestions.userId, users.id)).where(eq(productQuestions.productId, productId)).orderBy(asc(productQuestions.createdAt));
    const ids = questions.map((row) => row.question.id);
    const answers = ids.length ? await db.select({ answer: productAnswers, userName: users.fullName }).from(productAnswers).leftJoin(users, eq(productAnswers.userId, users.id)).where(inArray(productAnswers.questionId, ids)).orderBy(asc(productAnswers.createdAt)) : [];
    return ok({ questions: questions.map((row) => ({ ...row.question, userName: row.userName || "عميل", answers: answers.filter((answer) => answer.answer.questionId === row.question.id).map((answer) => ({ ...answer.answer, userName: answer.userName || "التاجر" })) })) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل أسئلة المنتج");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await context.params;
    const session = await requireAuth();
    const access = await assertMerchantProductAccess(session.userId, productId);
    if (access.error) return access.error;
    const payload = actionSchema.parse(await request.json());
    const [question] = await db.select().from(productQuestions).where(and(eq(productQuestions.id, payload.questionId), eq(productQuestions.productId, productId))).limit(1);
    if (!question) return fail("السؤال غير موجود لهذا المنتج", 404);

    if (payload.action === "reject") {
      await db.delete(productQuestions).where(eq(productQuestions.id, question.id));
      await writeAuditLog({ actorId: session.userId, action: "delete", category: "administrative", entityType: "product_question_rejected", entityId: question.id, afterData: { productId } });
      return ok({ message: "تم رفض السؤال وحذفه" });
    }
    if (payload.action === "approve") {
      await db.update(productQuestions).set({ isApproved: true }).where(eq(productQuestions.id, question.id));
      await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "product_question_approved", entityId: question.id, afterData: { productId } });
      return ok({ message: "تم اعتماد السؤال للعرض العام" });
    }
    const [answer] = await db.insert(productAnswers).values({ questionId: question.id, userId: session.userId, answer: payload.answer!, isApproved: true }).returning();
    await db.update(productQuestions).set({ isApproved: true }).where(eq(productQuestions.id, question.id));
    await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "product_question_answered", entityId: answer.id, afterData: { productId, questionId: question.id } });
    return ok({ answer, message: "تم اعتماد السؤال ونشر الرد" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث السؤال");
  }
}
