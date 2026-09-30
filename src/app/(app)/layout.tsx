import Link from "next/link";
import { logOut } from "@/app/login/actions";
import { NavLinks, TabBar } from "./nav-links";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:gap-10">
          <Link href="/" className="shrink-0 text-lg font-semibold sm:text-xl tracking-tight">
            Job Automation<span className="text-accent">.</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-4">
            <form action={logOut}>
              <button className="text-sm text-muted hover:text-foreground">Log out</button>
            </form>
            <Link href="/jobs/new" className="btn-primary">Add job</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:pt-8 sm:pb-10">{children}</main>
      <TabBar />
    </>
  );
}
