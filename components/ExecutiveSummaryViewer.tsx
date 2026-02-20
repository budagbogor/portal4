import React, { useMemo } from 'react';
import { Sparkles, Quote } from 'lucide-react';

interface ExecutiveSummaryViewerProps {
    summary: string;
}

export const ExecutiveSummaryViewer: React.FC<ExecutiveSummaryViewerProps> = ({ summary }) => {

    const parsedData = useMemo(() => {
        if (!summary) return null;

        // 1. Extract Preamble (Everything before the first numbered point "1.")
        // Handling potential formatting like "**1." or "1."
        const firstPointIndex = summary.search(/(?:\*\*|\b)1\./);

        let preamble = "";
        let pointsRaw = summary;

        if (firstPointIndex !== -1) {
            preamble = summary.substring(0, firstPointIndex).trim();
            pointsRaw = summary.substring(firstPointIndex);
        } else {
            preamble = summary;
            pointsRaw = "";
        }

        // Clean Preamble (remove "Executive Summary (...):")
        preamble = preamble.replace(/^Executive Summary.*?:/i, '').trim();

        // 3. Extract Final Verdict (if present)
        // Looks for "**Final Verdict:**" or "Final Verdict:" at the end
        let verdict = "";
        const verdictRegex = /(?:\*\*|)?Final Verdict:(?:\*\*|)?\s*(.*)$/i;
        const verdictMatch = pointsRaw.match(verdictRegex);

        if (verdictMatch) {
            verdict = verdictMatch[1].trim();
            // Remove verdict from pointsRaw so it doesn't get attached to the last point
            pointsRaw = pointsRaw.replace(verdictRegex, '').trim();
        }

        // 2. Extract Points using Regex
        // Matches "1. Title: Content"
        // Supports bold markers like **1. Title:**
        const points = [];
        const regex = /(?:^|\s)(?:\*\*)?(\d+)\.(?:\*\*)?\s+(.*?)(?=(?:^|\s)(?:\*\*)?\d+\.(?:\*\*)?|$)/gs;

        let match;
        while ((match = regex.exec(pointsRaw)) !== null) {
            // match[1] = Number (1)
            // match[2] = Content (Title: Body)

            const fullContent = match[2].trim();
            // Split Title and Body by first colon ":"
            const colonIndex = fullContent.indexOf(':');

            let title = "";
            let body = fullContent;

            if (colonIndex !== -1) {
                // Remove potential bold markers from title if they exist wrapping the whole thing
                title = fullContent.substring(0, colonIndex).replace(/\*\*/g, '').trim();
                body = fullContent.substring(colonIndex + 1).replace(/\*\*/g, '').trim();
            }

            points.push({
                id: match[1],
                title,
                body
            });
        }

        return { preamble, points, verdict };
    }, [summary]);

    if (!parsedData) return <p className="text-slate-400 italic">Analisa belum tersedia.</p>;

    return (
        <div className="space-y-8">
            {/* Preamble Section */}
            {parsedData.preamble && (
                <div className="relative bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <Quote className="absolute top-4 left-4 text-blue-200" size={24} />
                    <p className="relative z-10 text-slate-700 leading-relaxed italic indent-8">
                        {parsedData.preamble}
                    </p>
                </div>
            )}

            {/* Points Grid */}
            <div className="grid gap-6">
                {parsedData.points.map((point, idx) => (
                    <div key={idx} className="flex gap-4 group">
                        {/* Left Column: Number */}
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm group-hover:border-mobeng-blue group-hover:shadow-md transition-all">
                            <span className="text-xl font-black text-slate-300 group-hover:text-mobeng-blue transition-colors">
                                {point.id.padStart(2, '0')}
                            </span>
                        </div>

                        {/* Right Column: Content */}
                        <div className="flex-1 pt-1 pb-4 border-b border-slate-100 last:border-0">
                            <h4 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide flex items-center gap-2">
                                {point.title}
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed text-justify">
                                {point.body}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Verdict */}
            {parsedData.verdict && (
                <div className="mt-8 p-4 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                    <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Final Verdict</span>
                    <span className="text-2xl font-black tracking-tight">{parsedData.verdict.replace(/\*\*/g, '')}</span>
                </div>
            )}

            {/* Fallback if no points found */}
            {parsedData.points.length === 0 && !parsedData.verdict && (
                <div className="prose prose-sm text-slate-600">
                    {summary}
                </div>
            )}
        </div>
    );
};
