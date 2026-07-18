"use client";
import {
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { supabase } from "../../supabase";
import { RenderMessage, ToolBadges } from "./ui";
const AiBriefingCard = ({ briefing, briefingLoading, briefingTools, fetchBriefing }) => (
          <div
            style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 20,
              padding: "24px",
              marginBottom: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  padding: 8,
                  borderRadius: 10,
                  color: "#3b82f6"
                }}>
                  <MessageSquare size={18} />
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 1.2 }}>
                  Coach&apos;s Note
                </span>
              </div>
              <button
                onClick={() => {
                  supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) fetchBriefing(session);
                  });
                }}
                style={{
                  background: "none", border: "none", color: "#555", cursor: "pointer",
                  padding: 4, display: "flex", alignItems: "center",
                }}
                title="Refresh note"
              >
                <RefreshCw size={14} style={{ animation: briefingLoading ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>

            <div style={{
              borderLeft: "2px solid #3b82f6",
              paddingLeft: 16,
            }}>
              {briefingTools.length > 0 && !briefingLoading && (
                <ToolBadges tools={briefingTools} />
              )}
              {briefingLoading && !briefing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", height: 26 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#3b82f6",
                    animation: "pulse 1s ease-in-out infinite",
                  }} />
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6",
                    animation: "pulse 1s ease-in-out 0.2s infinite",
                  }} />
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#ec4899",
                    animation: "pulse 1s ease-in-out 0.4s infinite",
                  }} />
                  <span style={{ fontSize: "0.85rem", color: "#555", marginLeft: 4 }}>Analysing your data...</span>
                </div>
              ) : briefing ? (
                <RenderMessage text={briefing} streaming={briefingLoading} />
              ) : (
                <p style={{ margin: 0, fontSize: "0.95rem", color: "#555" }}>
                  Tap refresh to get your daily insight.
                </p>
              )}
            </div>
          </div>
);
export default AiBriefingCard;
