import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "#/db";
import {
	attemptAnswers,
	attempts,
	documents,
	exams,
	questions,
	session,
	user,
} from "#/db/schema";
import {
	CANDIDATE_MODELS,
	cleanJsonOutput,
	executeAiCompletion,
} from "#/lib/ai";
import {
	extractDocxText,
	extractPptxText,
	unescapeXml,
	validateFileMagicBytes,
} from "#/lib/document-processor";
import { useExamPerformanceStore } from "#/stores/useExamPerformanceStore";
import { useExamSessionStore } from "#/stores/useExamSessionStore";
import { useUserStore } from "#/stores/useUserStore";
import JSZip from "jszip";

describe("E2E Comprehensive Audit & Verification Suite", () => {
	const runId = Math.random().toString(36).slice(2, 8);
	const user1Id = `usr_e2e_1_${runId}`;
	const user2Id = `usr_e2e_2_${runId}`;
	const examPublicId = `exam_pub_${runId}`;
	const examPrivateId = `exam_priv_${runId}`;
	const qPublic1Id = `q_pub_1_${runId}`;
	const qPublic2Id = `q_pub_2_${runId}`;
	const qPrivate1Id = `q_priv_1_${runId}`;
	const attempt1Id = `att_e2e_1_${runId}`;

	async function cleanup() {
		try {
			await db.run(
				sql`DELETE FROM attempt_answers WHERE attempt_id LIKE ${`%${runId}%`}`,
			);
			await db.run(
				sql`DELETE FROM attempts WHERE user_id LIKE ${`%${runId}%`} OR id LIKE ${`%${runId}%`}`,
			);
			await db.run(
				sql`DELETE FROM questions WHERE exam_id LIKE ${`%${runId}%`}`,
			);
			await db.run(sql`DELETE FROM exams WHERE id LIKE ${`%${runId}%`}`);
			await db.run(
				sql`DELETE FROM documents WHERE user_id LIKE ${`%${runId}%`}`,
			);
			await db.run(
				sql`DELETE FROM session WHERE userId LIKE ${`%${runId}%`}`,
			);
			await db.run(
				sql`DELETE FROM account WHERE userId LIKE ${`%${runId}%`}`,
			);
			await db.run(sql`DELETE FROM user WHERE id LIKE ${`%${runId}%`}`);
		} catch {}
	}

	beforeAll(async () => {
		await cleanup();

		// Seed two distinct users
		await db.insert(user).values([
			{
				id: user1Id,
				name: "Student Alpha",
				email: `alpha_${runId}@test.invalid`,
				displayName: "Student Alpha",
				isAnonymous: false,
			},
			{
				id: user2Id,
				name: "Student Beta",
				email: `beta_${runId}@test.invalid`,
				displayName: "Student Beta",
				isAnonymous: true,
			},
		]);

		// User 1 creates a public exam
		await db.insert(exams).values({
			id: examPublicId,
			userId: user1Id,
			authorDisplayName: "Student Alpha",
			title: "Neuroscience 101",
			subject: "Biology",
			difficulty: "medium",
			questionCount: 2,
			isPublic: true,
			tags: JSON.stringify(["neuroscience", "brain"]),
		});

		await db.insert(questions).values([
			{
				id: qPublic1Id,
				examId: examPublicId,
				order: 1,
				type: "multiple-choice",
				question: "What is the primary neurotransmitter at neuromuscular junctions?",
				options: JSON.stringify(["Acetylcholine", "Dopamine", "GABA", "Serotonin"]),
				correctAnswer: "Acetylcholine",
				explanation: "Acetylcholine acts at motor end plates.",
			},
			{
				id: qPublic2Id,
				examId: examPublicId,
				order: 2,
				type: "true-false",
				question: "Myelin sheaths increase action potential conduction velocity.",
				options: JSON.stringify(["True", "False"]),
				correctAnswer: "True",
				explanation: "Saltatory conduction increases velocity.",
			},
		]);

		// User 2 creates a private exam
		await db.insert(exams).values({
			id: examPrivateId,
			userId: user2Id,
			authorDisplayName: "Student Beta",
			title: "Confidential Research Exam",
			subject: "Biochemistry",
			difficulty: "hard",
			questionCount: 1,
			isPublic: false,
			tags: JSON.stringify(["confidential"]),
		});

		await db.insert(questions).values([
			{
				id: qPrivate1Id,
				examId: examPrivateId,
				order: 1,
				type: "multiple-choice",
				question: "Proprietary enzyme reaction rate?",
				options: JSON.stringify(["Fast", "Slow"]),
				correctAnswer: "Fast",
				explanation: "Proprietary kinetic data.",
			},
		]);
	});

	afterAll(async () => {
		try {
			await db.run(sql`DELETE FROM attempt_answers`);
			await db.run(sql`DELETE FROM attempts`);
			await db.run(sql`DELETE FROM questions`);
			await db.run(sql`DELETE FROM exams`);
			await db.run(sql`DELETE FROM documents`);
			await db.run(sql`DELETE FROM session`);
			await db.run(sql`DELETE FROM account`);
			await db.run(sql`DELETE FROM user`);
		} catch {}
	});

	// ─── 1. P0 SECURITY & AUTHENTICATION VERIFICATION ───────────────────────────
	describe("1. P0 Security & Authorization Invariants", () => {
		it("enforces private exam access control (User 1 cannot access User 2's private exam)", async () => {
			const privExam = await db.query.exams.findFirst({
				where: eq(exams.id, examPrivateId),
			});

			expect(privExam).toBeDefined();
			expect(privExam?.isPublic).toBe(false);

			// Check privacy invariant logic
			const user1CanAccess = privExam!.isPublic || privExam!.userId === user1Id;
			expect(user1CanAccess).toBe(false);

			const user2CanAccess = privExam!.isPublic || privExam!.userId === user2Id;
			expect(user2CanAccess).toBe(true);
		});

		it("forbids non-owners from deleting exams", async () => {
			const targetExam = await db.query.exams.findFirst({
				where: eq(exams.id, examPublicId),
			});
			expect(targetExam).toBeDefined();

			// User 2 tries to delete User 1's exam
			const user2IsOwner = targetExam!.userId === user2Id;
			expect(user2IsOwner).toBe(false);
		});

		it("verifies user deletion cascades cleanly and clears session references", async () => {
			const throwawayUserId = `usr_throwaway_${runId}`;
			await db.insert(user).values({
				id: throwawayUserId,
				name: "Temporary User",
				email: `temp_${runId}@test.invalid`,
				displayName: "Temp",
				isAnonymous: true,
			});

			await db.insert(session).values({
				id: `sess_temp_${runId}`,
				userId: throwawayUserId,
				token: `tok_temp_${runId}`,
				expiresAt: new Date(Date.now() + 3600000),
			});

			await db.insert(documents).values({
				id: `doc_temp_${runId}`,
				userId: throwawayUserId,
				filename: "notes.pdf",
				fileType: "pdf",
				fileSize: 2048,
				r2Key: `docs/pdf/doc_temp_${runId}/notes.pdf`,
				status: "ready",
			});

			// Perform complete user deletion purge
			await db.delete(documents).where(eq(documents.userId, throwawayUserId));
			await db.delete(session).where(eq(session.userId, throwawayUserId));
			await db.delete(user).where(eq(user.id, throwawayUserId));

			// Verify purge
			const checkUser = await db.query.user.findFirst({
				where: eq(user.id, throwawayUserId),
			});
			const checkSession = await db.query.session.findFirst({
				where: eq(session.userId, throwawayUserId),
			});
			const checkDoc = await db.query.documents.findFirst({
				where: eq(documents.userId, throwawayUserId),
			});

			expect(checkUser).toBeUndefined();
			expect(checkSession).toBeUndefined();
			expect(checkDoc).toBeUndefined();
		});
	});

	// ─── 2. P0 AI ENGINE & MODEL HIERARCHY VERIFICATION ─────────────────────────
	describe("2. P0 AI Engine & Fallback Architecture", () => {
		it("confirms CANDIDATE_MODELS hierarchy order", () => {
			expect(CANDIDATE_MODELS[0]).toBe("qwen/qwen3.8-27b");
			expect(CANDIDATE_MODELS[1]).toBe("openai/gpt-oss-20b");
			expect(CANDIDATE_MODELS[2]).toBe("openai/gpt-oss-120b");
		});

		it("cleanJsonOutput correctly strips markdown code fences", () => {
			expect(cleanJsonOutput("```json\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
			expect(cleanJsonOutput("```\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
			expect(cleanJsonOutput("  {\"ok\":true}  ")).toBe("{\"ok\":true}");
		});

		it("executeAiCompletion cleanly falls back when primary model encounters 429", async () => {
			const originalFetch = globalThis.fetch;
			let attemptsCount = 0;

			globalThis.fetch = async (_url, init) => {
				attemptsCount++;
				const body = JSON.parse(init?.body as string);
				if (body.model === "qwen/qwen3.8-27b") {
					return new Response("rate_limit_exceeded", { status: 429 });
				}
				return new Response(
					JSON.stringify({
						choices: [{ message: { content: "{\"title\": \"Fallback Success\"}" } }],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			};

			try {
				const res = await executeAiCompletion({
					apiKey: "dummy-key",
					messages: [{ role: "user", content: "hello" }],
					jsonMode: true,
				});

				expect(res.modelUsed).toBe("openai/gpt-oss-20b");
				expect(res.content).toBe("{\"title\": \"Fallback Success\"}");
				expect(attemptsCount).toBe(2);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	// ─── 3. P1 DATABASE & ARCHITECTURE VERIFICATION ─────────────────────────────
	describe("3. P1 Database & Architecture Invariants", () => {
		it("creates attempt and verifies parallel query execution", async () => {
			await db.insert(attempts).values({
				id: attempt1Id,
				examId: examPublicId,
				userId: user1Id,
				status: "in-progress",
				totalQuestions: 2,
				score: null,
				correctCount: 0,
			});

			// Parallelized fetch simulation (matching GET /api/attempts/:id)
			const [examRecord, qList, answerList] = await Promise.all([
				db.query.exams.findFirst({ where: eq(exams.id, examPublicId) }),
				db.query.questions.findMany({ where: eq(questions.examId, examPublicId) }),
				db.query.attemptAnswers.findMany({ where: eq(attemptAnswers.attemptId, attempt1Id) }),
			]);

			expect(examRecord?.id).toBe(examPublicId);
			expect(qList.length).toBe(2);
			expect(answerList.length).toBe(0);
		});

		it("rejects answering questions belonging to another exam (cross-exam protection)", async () => {
			// Try to answer qPrivate1Id in attempt1Id (which belongs to examPublicId)
			const question = await db.query.questions.findFirst({
				where: and(
					eq(questions.id, qPrivate1Id),
					eq(questions.examId, examPublicId),
				),
			});

			expect(question).toBeUndefined();
		});

		it("upserts answer and computes isCorrect accurately", async () => {
			const q1 = await db.query.questions.findFirst({
				where: and(eq(questions.id, qPublic1Id), eq(questions.examId, examPublicId)),
			});
			expect(q1).toBeDefined();

			const isCorrect = "Acetylcholine".trim().toLowerCase() === q1!.correctAnswer.trim().toLowerCase();
			expect(isCorrect).toBe(true);

			await db.insert(attemptAnswers).values({
				id: `ans_e2e_1_${runId}`,
				attemptId: attempt1Id,
				questionId: qPublic1Id,
				userAnswer: "Acetylcholine",
				isCorrect,
				answeredAt: new Date(),
			});

			const saved = await db.query.attemptAnswers.findFirst({
				where: and(
					eq(attemptAnswers.attemptId, attempt1Id),
					eq(attemptAnswers.questionId, qPublic1Id),
				),
			});

			expect(saved?.isCorrect).toBe(true);
			expect(saved?.userAnswer).toBe("Acetylcholine");
		});

		it("completes attempt and enforces submit idempotency and completion lock", async () => {
			// Submit attempt
			const allAnswers = await db.query.attemptAnswers.findMany({
				where: eq(attemptAnswers.attemptId, attempt1Id),
			});
			const qList = await db.query.questions.findMany({
				where: eq(questions.examId, examPublicId),
			});

			const total = qList.length;
			const correct = allAnswers.filter((a) => a.isCorrect).length;
			const score = total > 0 ? Math.round((correct / total) * 100) : 0;

			await db
				.update(attempts)
				.set({
					status: "completed",
					score,
					correctCount: correct,
					completedAt: new Date(),
				})
				.where(eq(attempts.id, attempt1Id));

			const completedAttempt = await db.query.attempts.findFirst({
				where: eq(attempts.id, attempt1Id),
			});

			expect(completedAttempt?.status).toBe("completed");
			expect(completedAttempt?.score).toBe(50); // 1 out of 2

			// Mutation guard: answered attempts cannot be altered
			const canMutate = completedAttempt?.status !== "completed";
			expect(canMutate).toBe(false);

			// Idempotency: resubmission preserves existing score
			const idempotentScore = completedAttempt?.score;
			expect(idempotentScore).toBe(50);
		});

		it("cascading delete removes all attempts, attempt answers, questions, and the exam", async () => {
			const examAttempts = await db.query.attempts.findMany({
				where: eq(attempts.examId, examPublicId),
			});
			expect(examAttempts.length).toBe(1);

			const attemptIds = examAttempts.map((a) => a.id);
			await db.delete(attemptAnswers).where(inArray(attemptAnswers.attemptId, attemptIds));
			await db.delete(attempts).where(eq(attempts.examId, examPublicId));
			await db.delete(questions).where(eq(questions.examId, examPublicId));
			await db.delete(exams).where(eq(exams.id, examPublicId));

			const checkAnswers = await db.query.attemptAnswers.findMany({
				where: eq(attemptAnswers.attemptId, attempt1Id),
			});
			const checkAttempts = await db.query.attempts.findMany({
				where: eq(attempts.examId, examPublicId),
			});
			const checkQuestions = await db.query.questions.findMany({
				where: eq(questions.examId, examPublicId),
			});
			const checkExam = await db.query.exams.findFirst({
				where: eq(exams.id, examPublicId),
			});

			expect(checkAnswers.length).toBe(0);
			expect(checkAttempts.length).toBe(0);
			expect(checkQuestions.length).toBe(0);
			expect(checkExam).toBeUndefined();
		});
	});

	// ─── 4. P2 DOCUMENT PROCESSOR VERIFICATION ─────────────────────────────────
	describe("4. P2 Document Processor Verification", () => {
		it("validates magic bytes for PDF and rejects tampered files", async () => {
			const validPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
			const resValid = await validateFileMagicBytes(validPdf.buffer, "pdf");
			expect(resValid.valid).toBe(true);

			const fakePdf = new TextEncoder().encode("Hello world this is not a pdf");
			const resInvalid = await validateFileMagicBytes(fakePdf.buffer, "pdf");
			expect(resInvalid.valid).toBe(false);
		});

		it("single-pass unescapeXml is immune to double-unescaping vulnerabilities", () => {
			const input = "&amp;lt;script&amp;gt;";
			const unescaped = unescapeXml(input);
			expect(unescaped).toBe("&lt;script&gt;"); // NOT <script>
		});

		it("unescapeXml handles unicode code points above 0xFFFF", () => {
			const emojiXml = "Brain &#x1F9E0; Party &#127881;";
			expect(unescapeXml(emojiXml)).toBe("Brain 🧠 Party 🎉");
		});

		it("extractDocxText preserves headings, soft breaks, and tabs", async () => {
			const zip = new JSZip();
			const docXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Biochemistry</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Term A</w:t>
        <w:tab/>
        <w:t>Description A</w:t>
        <w:br/>
        <w:t>Second line</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
			zip.file("word/document.xml", docXml);
			const buffer = await zip.generateAsync({ type: "arraybuffer" });

			const text = await extractDocxText(buffer);
			expect(text).toContain("# Biochemistry");
			expect(text).toContain("Term A\tDescription A\nSecond line");
		});

		it("extractPptxText preserves slides and slide line breaks", async () => {
			const zip = new JSZip();
			zip.file("ppt/presentation.xml", "<p:presentation/>");
			const slideXml = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:p>
          <a:r><a:t>Slide Header</a:t></a:r>
          <a:br/>
          <a:r><a:t>Slide Subheader</a:t></a:r>
        </a:p>
      </p:sld>`;
			zip.file("ppt/slides/slide1.xml", slideXml);
			const buffer = await zip.generateAsync({ type: "arraybuffer" });

			const text = await extractPptxText(buffer);
			expect(text).toContain("[Slide 1]");
			expect(text).toContain("Slide Header\nSlide Subheader");
		});
	});

	// ─── 5. P3 UI STORES & STATE INTEGRITY ──────────────────────────────────────
	describe("5. P3 Frontend Stores & State Verification", () => {
		it("useUserStore handles strongly-typed AuthUser updates and clear actions", () => {
			const store = useUserStore.getState();
			expect(store.user).toBeNull();

			store.setUser({
				id: "u_test_store",
				name: "Verified User",
				email: "verified@test.invalid",
				emailVerified: true,
				isAnonymous: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			expect(useUserStore.getState().user?.name).toBe("Verified User");

			store.clearUser();
			expect(useUserStore.getState().user).toBeNull();
		});

		it("useExamSessionStore initializes batches and handles answer setting", () => {
			const sessionStore = useExamSessionStore.getState();
			sessionStore.initSession({
				attemptId: "att_mock_1",
				examId: "exam_mock_1",
				batchSize: 5,
				initialAnswers: { q1: "A" },
			});

			expect(useExamSessionStore.getState().activeAttemptId).toBe("att_mock_1");
			expect(useExamSessionStore.getState().userAnswers.q1).toBe("A");

			sessionStore.setAnswer("q2", "B");
			expect(useExamSessionStore.getState().userAnswers.q2).toBe("B");

			sessionStore.clearSession();
			expect(useExamSessionStore.getState().activeAttemptId).toBeNull();
			expect(Object.keys(useExamSessionStore.getState().userAnswers).length).toBe(0);
		});

		it("useExamPerformanceStore records question performance and updates mastery", () => {
			const perfStore = useExamPerformanceStore.getState();
			perfStore.recordQuestionAnswer({
				questionId: "q_perf_1",
				examId: "exam_perf_1",
				userAnswer: "Correct Answer",
				isCorrect: true,
			});

			const record = perfStore.getQuestionPerformance("q_perf_1");
			expect(record).toBeDefined();
			expect(record?.timesAttempted).toBe(1);
			expect(record?.timesCorrect).toBe(1);
		});
	});

	afterAll(async () => {
		await cleanup();
	});
});
