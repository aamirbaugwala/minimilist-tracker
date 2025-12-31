import './globals.css';

export const metadata = {
  title: 'Minimalist Macro Tracker',
  description: 'Track food simply.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}