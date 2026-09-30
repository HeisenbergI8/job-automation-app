// The app's loading mark: three listing rows that sweep in turn, like a scan down a job board
// (keyframes in globals.css). `small` is for inline use, beside text, and takes the text's colour so
// it shows on a filled button.
export function ScanMark({ small = false }: { small?: boolean }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 flex-col ${small ? "w-5 gap-[3px]" : "w-11 gap-[5px]"}`}>
      {["w-full", "w-[72%]", "w-[86%]"].map((width, index) => (
        <span
          key={width}
          className={`block origin-left rounded-full ${small ? "h-[3px] bg-current" : "h-[7px] bg-accent"} ${width} animate-[scan-row_1.1s_cubic-bezier(0.5,0,0.2,1)_infinite]`}
          style={{ animationDelay: `${[0, 0.12, 0.22][index]}s` }}
        />
      ))}
    </span>
  );
}
