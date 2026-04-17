import { useState } from "react";

const ShareCardDesigner = () => {
  const [variant, setVariant] = useState("clean");
  const [score, setScore] = useState(86);
  const [vibe, setVibe] = useState("MAFIA VIBE");

  const vibes = ["MAFIA VIBE", "OLD MONEY", "CLEAN MINIMAL", "STREET", "DATE NIGHT", "SHARP"];

  const variants = {
    clean: {
      label: "Clean",
      desc: "STYLIST top-center, score bottom-left, categories bottom-right. Most natural.",
    },
    editorial: {
      label: "Editorial",
      desc: "Heavier vignette, score large and centered at bottom. Magazine cover energy.",
    },
    corner: {
      label: "Corner Card",
      desc: "All info in a glass card in the corner. Least intrusive.",
    },
  };

  const CARD_W = 300;
  const CARD_H = 533;

  const FashionImageBg = () => (
    <div style={{ position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H }}>
      {/* Base warm tone */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        background: "linear-gradient(170deg, #5a4e42 0%, #3d352c 25%, #2a2420 50%, #1a1612 75%, #0e0c0a 100%)",
      }} />
      {/* Brick wall texture */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "70%", opacity: 0.12,
        background: `repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(200,180,160,0.15) 18px, rgba(200,180,160,0.15) 20px),
          repeating-linear-gradient(90deg, transparent, transparent 46px, rgba(200,180,160,0.1) 46px, rgba(200,180,160,0.1) 48px)`,
      }} />
      {/* Warm light from upper right */}
      <div style={{
        position: "absolute", top: "5%", right: "-5%", width: "60%", height: "50%",
        background: "radial-gradient(ellipse, rgba(200,170,130,0.12) 0%, transparent 65%)",
      }} />
      {/* Person silhouette - shoulders/head area */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "56%", height: "82%",
      }}>
        {/* Head hint */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 50, height: 50, borderRadius: "50%",
          background: "rgba(120,105,88,0.35)",
        }} />
        {/* Shoulders / torso */}
        <div style={{
          position: "absolute", top: 45, left: "10%", right: "10%", bottom: "38%",
          background: "linear-gradient(180deg, rgba(100,88,72,0.3) 0%, rgba(75,65,52,0.45) 100%)",
          borderRadius: "8px 8px 0 0",
        }} />
        {/* Jacket/coat shape */}
        <div style={{
          position: "absolute", top: 60, left: "5%", right: "5%", bottom: "35%",
          background: "rgba(80,70,58,0.25)",
          borderRadius: "4px",
        }} />
        {/* Left leg */}
        <div style={{
          position: "absolute", bottom: 0, left: "18%", width: "28%", height: "38%",
          background: "linear-gradient(180deg, rgba(55,48,40,0.4) 0%, rgba(40,35,28,0.5) 100%)",
        }} />
        {/* Right leg */}
        <div style={{
          position: "absolute", bottom: 0, right: "18%", width: "28%", height: "38%",
          background: "linear-gradient(180deg, rgba(55,48,40,0.4) 0%, rgba(40,35,28,0.5) 100%)",
        }} />
      </div>
      {/* "Your image here" label */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        color: "rgba(255,255,255,0.08)", fontSize: 10, fontWeight: 600,
        letterSpacing: 3, textTransform: "uppercase", textAlign: "center",
        pointerEvents: "none",
      }}>
        YOUR AI<br/>OUTFIT<br/>IMAGE
      </div>
    </div>
  );

  const CleanOverlay = () => (
    <>
      <div style={{
        position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H * 0.28,
        background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 65%, transparent 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: CARD_W, height: CARD_H * 0.38,
        background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, transparent 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", top: 18, left: 0, width: CARD_W,
        display: "flex", justifyContent: "center", zIndex: 3,
      }}>
        <span style={{
          color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 400,
          letterSpacing: 5, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
        }}>STYLIST</span>
      </div>
      <div style={{
        position: "absolute", bottom: 22, left: 18, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{
            color: "#3ECF71", fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: -1,
          }}>{score}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 300 }}>/100</span>
        </div>
        <span style={{
          color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 500,
          letterSpacing: 2.5, textTransform: "uppercase",
        }}>{vibe}</span>
      </div>
      <div style={{
        position: "absolute", bottom: 24, right: 14, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end",
      }}>
        {[{l:"AURA",v:92},{l:"FIT",v:score},{l:"PALETTE",v:80},{l:"TREND",v:82}].map(c => (
          <div key={c.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 7, fontWeight: 500, letterSpacing: 1 }}>{c.l}</span>
            <span style={{ color: "rgba(62,207,113,0.7)", fontSize: 10, fontWeight: 600 }}>{c.v}</span>
          </div>
        ))}
      </div>
    </>
  );

  const EditorialOverlay = () => (
    <>
      <div style={{
        position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H * 0.32,
        background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: CARD_W, height: CARD_H * 0.48,
        background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 40%, transparent 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H,
        background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", top: 16, left: 0, width: CARD_W,
        display: "flex", justifyContent: "center", zIndex: 3,
      }}>
        <span style={{
          color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 400,
          letterSpacing: 6, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
        }}>STYLIST</span>
      </div>
      <div style={{
        position: "absolute", bottom: 18, left: 0, width: CARD_W, zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        <span style={{
          color: "#3ECF71", fontSize: 50, fontWeight: 700, lineHeight: 1, letterSpacing: -2,
        }}>{score}</span>
        <span style={{
          color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 500,
          letterSpacing: 3, textTransform: "uppercase",
        }}>{vibe}</span>
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          {[{l:"AURA",v:92},{l:"FIT",v:score},{l:"PALETTE",v:80},{l:"TREND",v:82}].map(c => (
            <div key={c.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ color: "rgba(62,207,113,0.65)", fontSize: 12, fontWeight: 600 }}>{c.v}</span>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 6, fontWeight: 500, letterSpacing: 1 }}>{c.l}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const CornerOverlay = () => (
    <>
      <div style={{
        position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: CARD_W, height: CARD_H * 0.22,
        background: "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
        zIndex: 2,
      }} />
      <div style={{
        position: "absolute", top: 14, left: 0, width: CARD_W,
        display: "flex", justifyContent: "center", zIndex: 3,
      }}>
        <span style={{
          color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 400,
          letterSpacing: 4, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
        }}>STYLIST</span>
      </div>
      <div style={{
        position: "absolute", bottom: 14, left: 12, zIndex: 3,
        background: "rgba(0,0,0,0.6)", borderRadius: 12, padding: "10px 14px",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", gap: 5, minWidth: 130,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ color: "#3ECF71", fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: -0.5 }}>{score}</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>{vibe}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
          {[{l:"AURA",v:92},{l:"FIT",v:score},{l:"PALETTE",v:80},{l:"TREND",v:82}].map(c => (
            <div key={c.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 7, letterSpacing: 0.8, fontWeight: 500 }}>{c.l}</span>
              <span style={{ color: "rgba(62,207,113,0.7)", fontSize: 10, fontWeight: 600 }}>{c.v}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const getOverlay = () => {
    switch (variant) {
      case "clean": return <CleanOverlay />;
      case "editorial": return <EditorialOverlay />;
      case "corner": return <CornerOverlay />;
      default: return <CleanOverlay />;
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080808", color: "#fff",
      fontFamily: "-apple-system, 'SF Pro Display', sans-serif", padding: "20px 16px",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>
          Stylist Share Card Designer
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 24, lineHeight: 1.5 }}>
          This is what each slideshow image looks like with the Stylist overlay — 
          "STYLIST" + score baked into the image like a native app screenshot.
        </p>

        {/* Variant buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          {Object.entries(variants).map(([key, { label }]) => (
            <button key={key} onClick={() => setVariant(key)} style={{
              padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
              border: variant === key ? "1px solid #3ECF71" : "1px solid rgba(255,255,255,0.08)",
              background: variant === key ? "rgba(62,207,113,0.1)" : "rgba(255,255,255,0.03)",
              color: variant === key ? "#3ECF71" : "rgba(255,255,255,0.5)",
            }}>{label}</button>
          ))}
        </div>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 24 }}>
          {variants[variant].desc}
        </p>

        {/* Main layout */}
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
          
          {/* THE SHARE CARD */}
          <div style={{
            width: CARD_W, height: CARD_H, borderRadius: 18, overflow: "hidden",
            position: "relative", flexShrink: 0,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          }}>
            <FashionImageBg />
            {getOverlay()}
          </div>

          {/* Controls + info panel */}
          <div style={{ flex: "1 1 260px", minWidth: 250 }}>
            
            {/* Vibe selector */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                Try different vibes
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {vibes.map(v => (
                  <button key={v} onClick={() => setVibe(v)} style={{
                    padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                    border: vibe === v ? "1px solid rgba(62,207,113,0.4)" : "1px solid rgba(255,255,255,0.06)",
                    background: vibe === v ? "rgba(62,207,113,0.08)" : "transparent",
                    color: vibe === v ? "#3ECF71" : "rgba(255,255,255,0.35)",
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Score slider */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                Score: {score}
              </p>
              <input type="range" min="40" max="99" value={score}
                onChange={(e) => setScore(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "#3ECF71", height: 4 }}
              />
            </div>

            {/* Why this works */}
            <div style={{
              background: "rgba(62,207,113,0.04)", borderRadius: 12, padding: 14,
              border: "1px solid rgba(62,207,113,0.08)", marginBottom: 16,
            }}>
              <p style={{ color: "#3ECF71", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                Why this works
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "👁", text: "\"STYLIST\" is visible on every image — people see the brand without you ever saying \"download\"" },
                  { icon: "📱", text: "Looks like a screenshot FROM the app, not a graphic ABOUT the app. Content, not advertising." },
                  { icon: "🔍", text: "Curious viewers search \"Stylist app\" on the App Store — no link in bio needed to convert." },
                  { icon: "🔄", text: "When real users share, their screenshots look like this — you're training the visual format early." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 11, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How to make it */}
            <div style={{
              background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 14,
              border: "1px solid rgba(255,255,255,0.05)", marginBottom: 16,
            }}>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                How to make this in Canva (free)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  "Create 1080×1920 design in Canva",
                  "Place your AI fashion image as background",
                  "Add a dark gradient overlay (top → transparent → bottom dark)",
                  "Add \"STYLIST\" text top-center — italic serif, white, ~40% opacity",
                  "Add score number in green (#3ECF71) at bottom",
                  "Add vibe label in white uppercase below it",
                  "Optionally add 4 tiny category scores",
                  "Duplicate → swap image + numbers for each slide",
                ].map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                    <span style={{ color: "#3ECF71", fontSize: 9, fontWeight: 700, minWidth: 14 }}>{i + 1}.</span>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Which variant per slideshow */}
            <div style={{
              background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 14,
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                Which style for which slideshow
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { post: "Slideshow 1: Weekly Fits", rec: "Clean", why: "Score bottom-left, STYLIST top. Other non-stamp slides are plain images with just a day label." },
                  { post: "Slideshow 2: One Jacket 5 Ways", rec: "Corner Card", why: "Least intrusive — people focus on styling. Glass card sits quietly." },
                  { post: "Slideshow 3: 3 Vibes", rec: "Editorial", why: "Big centered score IS the content. People compare vibes — make score the punchline." },
                ].map((row, i) => (
                  <div key={i} style={{
                    padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600 }}>{row.post}</span>
                      <span style={{
                        color: "#3ECF71", fontSize: 10, fontWeight: 600,
                        background: "rgba(62,207,113,0.1)", padding: "2px 8px", borderRadius: 4,
                      }}>{row.rec}</span>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, lineHeight: 1.5, margin: 0 }}>{row.why}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TikTok handle suggestions */}
        <div style={{
          marginTop: 28, padding: 16, background: "rgba(62,207,113,0.04)",
          borderRadius: 14, border: "1px solid rgba(62,207,113,0.1)",
        }}>
          <p style={{ color: "#3ECF71", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            TikTok Account Name — Pick One
          </p>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>
            Your handle is the strongest passive CTA. Every share carries your brand. 
            Match it to what people see on the card ("STYLIST").
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { handle: "@stylist.ai", note: "Clean, searchable" },
              { handle: "@trystylist", note: "Action-oriented" },
              { handle: "@stylistapp", note: "Direct, no ambiguity" },
              { handle: "@stylist.fits", note: "Fashion-first" },
              { handle: "@getstylist", note: "CTA in the name" },
            ].map(opt => (
              <div key={opt.handle} style={{
                padding: "8px 12px", background: "rgba(255,255,255,0.03)",
                borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", flexDirection: "column", gap: 2,
              }}>
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 600 }}>{opt.handle}</span>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>{opt.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Long-term play */}
        <div style={{
          marginTop: 16, padding: 14, background: "rgba(255,255,255,0.02)",
          borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.6, margin: 0 }}>
            💡 <strong style={{ color: "rgba(255,255,255,0.7)" }}>Long-term play:</strong>{" "}
            Build this exact share card as a native feature in your app. Add a "Share" button 
            that exports this layout as a PNG — outfit image + vignette + STYLIST + score. 
            When real users start sharing their own scores, every share is a piece of UGC 
            that looks exactly like your TikTok content. The format becomes self-reinforcing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareCardDesigner;
