import AppShell from "../src/components/AppShell";
import "../styles.css";

export const metadata = {
  title: "mumbl",
  description: "say the thing you've been mumbling all week.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
