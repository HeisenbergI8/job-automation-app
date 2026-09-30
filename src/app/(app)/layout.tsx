import { Sidebar, TabBar, TopBar } from "./shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {/* The bottom padding clears the phone tab bar; on a laptop there is none. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-12">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
