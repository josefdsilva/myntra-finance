import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-muted/60" {...props} />,
  th: (props) => (
    <th
      className="border border-border px-2 py-1 text-left font-medium"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-border px-2 py-1 align-top" {...props} />
  ),
  tr: (props) => <tr className="even:bg-muted/20" {...props} />,
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <pre className="my-2 overflow-x-auto rounded-md bg-muted p-2 text-xs">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...rest}>
        {children}
      </code>
    );
  },
  ul: (props) => <ul className="my-1 list-disc pl-5 space-y-0.5" {...props} />,
  ol: (props) => (
    <ol className="my-1 list-decimal pl-5 space-y-0.5" {...props} />
  ),
  a: (props) => (
    <a
      className="underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
