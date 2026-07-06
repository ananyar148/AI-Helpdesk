import ClientSessionProvider from './SessionProvider';

export const metadata = {
  title: 'HelpDesk — Client Portal',
  description: 'Submit and track your support tickets.',
};

export default function PortalLayout({ children }) {
  return (
    <ClientSessionProvider>
      {children}
    </ClientSessionProvider>
  );
}
