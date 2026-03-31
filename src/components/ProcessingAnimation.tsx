"use client";

import { useState, useEffect } from "react";

const SCENES = [
  {
    name: "egg",
    frames: [
      [
        "      ___      ",
        "     /   \\     ",
        "    |  .  |    ",
        "     \\___/     ",
        "   _________   ",
        "  /         \\  ",
        " /___________\\ ",
      ],
      [
        "      ___      ",
        "     / ~ \\     ",
        "    | .°  |    ",
        "     \\___/     ",
        "   _________   ",
        "  /  ~ ~ ~  \\  ",
        " /___________\\ ",
      ],
      [
        "      ___      ",
        "     /~  \\     ",
        "    |  °. |    ",
        "     \\___/     ",
        "   _________   ",
        "  / ~ ~ ~ ~ \\  ",
        " /___________\\ ",
      ],
    ],
  },
  {
    name: "whisk",
    frames: [
      [
        "       |       ",
        "       |       ",
        "      /|\\      ",
        "     / | \\     ",
        "    (  |  )    ",
        "     \\ | /     ",
        "      \\|/      ",
        "    ~~~~~~     ",
      ],
      [
        "       |       ",
        "       |       ",
        "      /|\\      ",
        "     / | \\     ",
        "    (  |  )    ",
        "     \\ | /     ",
        "      \\|/      ",
        "   ~~~~~~~~    ",
      ],
      [
        "       |       ",
        "       |       ",
        "      /|\\      ",
        "     / | \\     ",
        "    (  |  )    ",
        "     \\ | /     ",
        "      \\|/      ",
        "     ~~~~~~    ",
      ],
    ],
  },
  {
    name: "pot",
    frames: [
      [
        "               ",
        "    ~  ~  ~    ",
        "   =========   ",
        "   |       |   ",
        "   |       |   ",
        "   |       |   ",
        "   |_______|   ",
        "    \\_____/    ",
      ],
      [
        "      ~        ",
        "   ~     ~     ",
        "   =========   ",
        "   |       |   ",
        "   |       |   ",
        "   |       |   ",
        "   |_______|   ",
        "    \\_____/    ",
      ],
      [
        "         ~     ",
        "    ~  ~       ",
        "   =========   ",
        "   |       |   ",
        "   |       |   ",
        "   |       |   ",
        "   |_______|   ",
        "    \\_____/    ",
      ],
    ],
  },
];

const MESSAGES = [
  "EXTRACTING RECIPE",
  "READING INGREDIENTS",
  "PARSING INSTRUCTIONS",
  "CONVERTING UNITS",
  "PLATING UP",
];

export function ProcessingAnimation() {
  const [scene] = useState(() =>
    SCENES[Math.floor(Math.random() * SCENES.length)]
  );
  const [frame, setFrame] = useState(0);
  const [dots, setDots] = useState(0);
  const [messageIdx, setMessageIdx] = useState(0);

  useEffect(() => {
    const frameInterval = setInterval(() => {
      setFrame((f) => (f + 1) % scene.frames.length);
    }, 400);

    const dotsInterval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);

    const messageInterval = setInterval(() => {
      setMessageIdx((m) => (m + 1) % MESSAGES.length);
    }, 2000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(dotsInterval);
      clearInterval(messageInterval);
    };
  }, [scene.frames.length]);

  return (
    <div className="py-8 flex flex-col items-center gap-4">
      <pre className="font-[family-name:var(--font-pixel)] text-[14px] leading-[1.3] text-black select-none">
        {scene.frames[frame].join("\n")}
      </pre>
      <p className="font-[family-name:var(--font-pixel)] text-[11px] uppercase tracking-[0.2em] text-gray">
        {MESSAGES[messageIdx]}{".".repeat(dots)}
      </p>
    </div>
  );
}
