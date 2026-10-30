import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import TopHeader from "../components/TopHeader";
import { authClient, useSession } from "../lib/auth-client";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'dark';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Gen — AI Exam Generator & Practice Platform" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
	component: AppShell,
});

// ─── App shell: sidebar + main content area ───────────────────────────────
function AppShell() {
	const { data: session, isPending } = useSession();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isAdminPage = pathname.replace(/\/+$/, "") === "/api";

	useEffect(() => {
		if (isAdminPage) return;
		if (!isPending && !session) {
			authClient.signIn.anonymous().catch(() => {
				// silently ignore — session may already exist
			});
		}
	}, [isPending, session, isAdminPage]);

	if (isAdminPage) {
		return <Outlet />;
	}

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]">
			<Sidebar />
			<div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
				<TopHeader />
				<main className="flex-1 overflow-y-auto min-w-0">
					<Outlet />
				</main>
				<footer className="h-9 border-t border-[var(--border-subtle)] bg-[var(--bg-main)]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 text-[11px] sm:text-xs text-[var(--text-muted)] select-none">
					<span>GEN &copy; 2026. All rights reserved.</span>
					<Link
						to="/terms-and-privacy"
						className="hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline"
					>
						Terms &amp; Privacy
					</Link>
				</footer>
			</div>
		</div>
	);
}

// ─── HTML document shell ──────────────────────────────────────────────────
function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme script avoids flash */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased selection:bg-[var(--border-strong)] selection:text-[var(--text-primary)] bg-[var(--bg-main)] text-[var(--text-primary)]">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
