import "./echo.css";
import { render } from "preact";
import { EchoShow } from "./EchoShow";

const root = document.getElementById("echo-root");
if (root) render(<EchoShow pollMs={Number(root.dataset.pollMs ?? 3000)} />, root);
