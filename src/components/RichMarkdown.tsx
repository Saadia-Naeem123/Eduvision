import { useEffect, useRef, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "Inter, system-ui, sans-serif",
  themeVariables: {
    primaryColor: "#7c3aed",
    primaryTextColor: "#f5f3ff",
    primaryBorderColor: "#a78bfa",
    lineColor: "#67e8f9",
    background: "transparent",
  },
});

function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const id = `m-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => { if (alive && ref.current) ref.current.innerHTML = svg; })
      .catch((e) => alive && setErr(String(e?.message ?? e)));
    return () => { alive = false; };
  }, [code]);
  if (err) return <pre className="text-[11px] text-destructive whitespace-pre-wrap">{code}</pre>;
  return <div ref={ref} className="my-3 overflow-x-auto flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />;
}

export const RichMarkdown = memo(function RichMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words
      [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
      [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5
      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
      [&_p]:my-2
      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
      [&_li]:marker:text-primary
      [&_strong]:font-semibold [&_strong]:text-foreground
      [&_em]:italic
      [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
      [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground
      [&_code]:bg-background/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono
      [&_pre]:bg-background/70 [&_pre]:rounded-xl [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-[12px]
      [&_pre_code]:bg-transparent [&_pre_code]:p-0
      [&_hr]:my-3 [&_hr]:border-border/60
      [&_img]:rounded-xl [&_img]:my-2 [&_img]:max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Tables wrapped for horizontal scroll on mobile
          table: ({ children }) => (
            <div className="my-3 -mx-1 overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-[12px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-primary/15">{children}</thead>,
          th: ({ children }) => <th className="px-2.5 py-2 text-left font-semibold border-b border-border/60 whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="px-2.5 py-2 border-b border-border/40 align-top">{children}</td>,
          tr: ({ children }) => <tr className="hover:bg-background/30">{children}</tr>,
          code: (props: any) => {
            const { inline, className, children } = props;
            const match = /language-(\w+)/.exec(className ?? "");
            const lang = match?.[1];
            const text = String(children ?? "").replace(/\n$/, "");
            if (!inline && lang === "mermaid") return <Mermaid code={text} />;
            if (!inline && lang) {
              return (
                <pre><code className={className}>{text}</code></pre>
              );
            }
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
