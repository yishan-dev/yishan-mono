import { app } from "electron";
import { DesktopApplication } from "./DesktopApplication";

// Raise the Chromium WebGL context limit from the default 16.
// Each xterm terminal tab consumes one WebGL context for GPU-accelerated
// rendering. Without this, opening many terminals causes Chromium to evict
// older WebGL contexts, forcing those terminals back to the slow DOM renderer.
app.commandLine.appendSwitch("max-active-webgl-contexts", "64");

DesktopApplication.run();
