import { appMetadata } from '@/config/app';

export default function HomePage() {
  return (
    <main
      style={{
        alignItems: 'center',
        background: '#f8fafc',
        color: '#111827',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
      }}
    >
      <h1>{appMetadata.name}</h1>
      <p>Admin foundation is ready.</p>
    </main>
  );
}
