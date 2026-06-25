import './globals.css';

export const metadata = {
  title: 'HelpDesk — AI-Powered Support',
  description: 'Submit and manage support tickets with AI-assisted classification and response drafting.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
