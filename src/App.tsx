import { type ParentProps } from "solid-js";
import Sidebar from "./components/Sidebar";
import DocPage from "./components/DocPage";

export default function App(props: ParentProps) {
  return (
    <div class="flex h-screen overflow-hidden">
      <Sidebar />
      <main class="flex-1 overflow-y-auto">
        <DocPage />
      </main>
    </div>
  );
}
