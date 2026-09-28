import { logOut } from "@/app/login/actions";
import { NavLinks } from "./nav-links";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="shrink-0 font-semibold">Job Automation</span>
          <NavLinks />
          <form action={logOut} className="ml-auto">
            <button className="text-sm text-muted hover:text-foreground">Log out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
