import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms-and-privacy")({
	component: TermsAndPrivacyPage,
});

function TermsAndPrivacyPage() {
	return (
		<div className="min-h-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-10 animate-fade-in text-[var(--text-primary)]">
			{/* ─── Page Header ────────────────────────────────────────────────────────── */}
			<header className="space-y-2 pb-6 border-b border-[var(--border-subtle)]">
				<h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
					Terms, Privacy &amp; User Guide
				</h1>
				<p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
					Comprehensive documentation for the GEN platform, including platform
					usage guidelines, terms of service, and our privacy policy.
				</p>
			</header>

			{/* ─── 1. HOW TO USE GEN ──────────────────────────────────────────────────── */}
			<section id="how-to-use" className="gen-card p-6 sm:p-8 space-y-6">
				<div className="space-y-1 pb-4 border-b border-[var(--border-subtle)]">
					<h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
						How to Use GEN
					</h2>
					<p className="text-xs text-[var(--text-secondary)]">
						Guidelines on creating, configuring, and practicing exams on the
						platform.
					</p>
				</div>

				<div className="space-y-6 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							1. Source Material &amp; Inputs
						</h3>
						<p>
							Exams can be generated either from a written topic prompt,
							directly pasted questions, or uploaded documents. Supported file
							formats include PDF (
							<code className="text-[11px] font-mono">.pdf</code>), Microsoft
							PowerPoint (<code className="text-[11px] font-mono">.pptx</code>),
							and Microsoft Word (
							<code className="text-[11px] font-mono">.docx</code>) up to 50 MB
							in size.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							2. Exam Configuration &amp; Modes
						</h3>
						<p>
							When setting up an exam, you can customize question counts (up to
							30), question formats (Multiple Choice, True/False, or mixed), and
							difficulty levels (Easy, Medium, Hard).
						</p>
						<p className="mt-1">Two distinct practice modes are available:</p>
						<ul className="list-disc list-inside mt-1 space-y-1 text-xs text-[var(--text-secondary)]">
							<li>
								<strong>Instant Feedback Mode:</strong> Validates answers
								immediately upon selection, reveals full step-by-step
								mathematical and conceptual proofs, and enables on-demand AI
								explanations.
							</li>
							<li>
								<strong>Exam Mode:</strong> Simulates formal test conditions
								with silent, timed answering. Solutions remain hidden until
								complete submission, followed by a diagnostic performance
								report.
							</li>
						</ul>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							3. Library &amp; Progress Tracking
						</h3>
						<p>
							Generated exams are saved to your personal library where you can
							review historical attempts, track score improvements over time,
							and revisit step-by-step proofs. Guest sessions can be linked to a
							permanent email account at any time with full data retention.
						</p>
					</div>
				</div>
			</section>

			{/* ─── 2. TERMS OF SERVICE ────────────────────────────────────────────────── */}
			<section id="terms-of-service" className="gen-card p-6 sm:p-8 space-y-6">
				<div className="space-y-1 pb-4 border-b border-[var(--border-subtle)]">
					<h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
						Terms of Service
					</h2>
					<p className="text-xs text-[var(--text-muted)]">
						Last modified: October 2026
					</p>
				</div>

				<div className="space-y-5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							1. Acceptance of Agreement
						</h3>
						<p>
							By accessing, browsing, or utilizing the services provided by GEN,
							you acknowledge that you have read, understood, and agree to be
							legally bound by these Terms of Service. If you do not agree with
							any provision of these terms, you must discontinue platform use
							immediately.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							2. Educational Purpose &amp; Academic Integrity
						</h3>
						<p>
							GEN is operated strictly as an educational study companion and
							test preparation tool. It is designed for self-assessment, study
							reinforcement, and concept practice. Users remain solely
							responsible for adhering to the academic honesty policies, student
							honor codes, and ethical guidelines of their schools,
							universities, and professional institutions.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							3. Artificial Intelligence Disclaimer
						</h3>
						<p>
							All questions, solutions, feedback, and proofs on GEN are
							generated using advanced artificial intelligence language models.
							While rigorous multi-step validation checks are executed,
							automated AI systems may occasionally produce inaccurate,
							incomplete, or out-of-date information. Content is delivered on an
							&ldquo;as is&rdquo; basis without warranties of completeness or
							merchantability. GEN is not a replacement for accredited
							coursework or instructor verification.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							4. Fair Usage &amp; Operational Limits
						</h3>
						<p>
							To maintain system stability, ensure equitable access, and prevent
							infrastructure abuse, the following operational limits are
							enforced:
						</p>
						<ul className="list-disc list-inside mt-1.5 space-y-1 text-xs text-[var(--text-secondary)]">
							<li>Maximum document file size: 50 MB per file.</li>
							<li>
								Maximum concurrent active uploads: 3 files simultaneously.
							</li>
							<li>Maximum upload frequency: 15 files per 24-hour window.</li>
							<li>Exam generation cooldown: 30 seconds between requests.</li>
							<li>
								Daily exam generation limit: 10 exams per day for guest
								accounts; 25 exams per day for registered accounts.
							</li>
						</ul>
						<p className="mt-1.5">
							Scripted automation, distributed denial-of-service attacks,
							automated scrapers, and deliberate attempts to circumvent rate
							limiting mechanisms are strictly prohibited and may result in
							permanent access revocation.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							5. Intellectual Property
						</h3>
						<p>
							Users retain full intellectual property rights to the original
							study notes, documents, and materials they upload. By uploading
							materials, users grant the platform a limited license strictly to
							extract text and generate requested exam questions. Exam questions
							and explanations produced by the platform are licensed to the user
							for personal, non-commercial educational use.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							6. External API Service
						</h3>
						<p>
							GEN provides a server-to-server External API that generates
							multiple-choice and true/false exams from supplied source
							material. The endpoint is{" "}
							<code className="text-[11px] font-mono">
								POST https://gen.hun-wrk0966.workers.dev/api/v1/generate
							</code>
							, and access requires a project and API key issued through the
							admin console at{" "}
							<Link
								to="/api"
								className="font-semibold text-[var(--text-primary)] underline underline-offset-2 hover:opacity-80"
							>
								/api
							</Link>
							.
						</p>
						<ul className="list-disc list-inside mt-1.5 space-y-1 text-xs text-[var(--text-secondary)]">
							<li>
								API keys are secret credentials and are displayed only once when
								created. Store them in a secret manager and never expose them in
								client-side code, source repositories, or public requests.
							</li>
							<li>
								Each project is subject to per-minute request, daily request,
								and daily token limits. These are hard stops enforced
								automatically.
							</li>
							<li>
								Keys may be revoked and projects disabled at any time at our
								discretion to prevent abuse, enforce these terms, or protect
								platform integrity.
							</li>
							<li>
								API-generated content is produced by the same artificial
								intelligence models and is subject to the Artificial
								Intelligence Disclaimer above.
							</li>
							<li>
								Scripted abuse, scraping, distributed requests, or deliberate
								attempts to bypass rate limiting via the External API are
								strictly prohibited and may result in immediate revocation.
							</li>
						</ul>
					</div>
				</div>
			</section>

			{/* ─── 3. PRIVACY POLICY ──────────────────────────────────────────────────── */}
			<section id="privacy-policy" className="gen-card p-6 sm:p-8 space-y-6">
				<div className="space-y-1 pb-4 border-b border-[var(--border-subtle)]">
					<h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
						Privacy Policy
					</h2>
					<p className="text-xs text-[var(--text-muted)]">
						Last modified: October 2026
					</p>
				</div>

				<div className="space-y-5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							1. Information Collection
						</h3>
						<p>
							GEN minimizes data collection to only what is necessary to operate
							the study platform:
						</p>
						<ul className="list-disc list-inside mt-1.5 space-y-1 text-xs text-[var(--text-secondary)]">
							<li>
								<strong>Guest Sessions:</strong> Unauthenticated visitors are
								assigned an anonymous identifier stored in an encrypted,
								HTTP-only cookie. No personal identifying information (name,
								email, or telephone) is required to use the service.
							</li>
							<li>
								<strong>Account Credentials:</strong> If you register or link an
								account, we store your email address, display handle, and
								cryptographically salted password hashes.
							</li>
							<li>
								<strong>Uploaded Materials:</strong> Study documents uploaded
								for exam generation are stored temporarily in encrypted cloud
								storage solely for the duration necessary to extract text and
								synthesize questions.
							</li>
						</ul>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							2. Data Protection Commitments
						</h3>
						<ul className="list-disc list-inside space-y-1 text-xs text-[var(--text-secondary)]">
							<li>
								We do not sell, rent, monetize, or trade user data or uploaded
								documents to third-party advertisers or data brokers.
							</li>
							<li>
								Uploaded user study materials are not utilized to train public
								commercial AI models.
							</li>
							<li>
								All web traffic is transmitted across encrypted TLS/HTTPS
								protocols.
							</li>
						</ul>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							3. User Control &amp; Deletion
						</h3>
						<p>
							Users maintain authority over their data. Individual exam records,
							attempts, and uploaded documents can be removed directly via your
							library. Complete account termination and deletion of all
							associated historical records can be initiated at any time via{" "}
							<Link
								to="/settings"
								className="font-semibold text-[var(--text-primary)] underline underline-offset-2 hover:opacity-80"
							>
								Settings
							</Link>
							.
						</p>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							4. External API Data Practices
						</h3>
						<ul className="list-disc list-inside space-y-1 text-xs text-[var(--text-secondary)]">
							<li>
								<strong>Usage metadata:</strong> We record request metadata only
								— request ID, external ID, status, outcome, error code, schema
								source, model, token usage, latency, and timestamps. Source
								content, generated exams, schema bodies, and client IP addresses
								are not stored in API usage records.
							</li>
							<li>
								<strong>Idempotency:</strong> Completed response bodies are
								retained for up to 24 hours solely to support safe idempotent
								retries, then removed.
							</li>
							<li>
								<strong>API keys:</strong> Keys are stored as one-way
								cryptographic hashes. The full key is never displayed or
								retrievable after creation.
							</li>
						</ul>
					</div>

					<div className="space-y-1.5">
						<h3 className="font-bold text-[var(--text-primary)] text-sm">
							5. Policy Amendments
						</h3>
						<p>
							This Privacy Policy may be modified periodically to reflect
							operational changes or statutory compliance. Continued use of the
							platform after modifications indicates acknowledgment of the
							revised policy.
						</p>
					</div>
				</div>
			</section>
		</div>
	);
}
