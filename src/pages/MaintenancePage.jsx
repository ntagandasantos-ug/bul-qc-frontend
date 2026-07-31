export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '40px 32px',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        maxWidth: '440px',
        width: '100%'
      }}>
        <h1 style={{ margin: '0 0 12px', fontSize: '1.8rem', color: '#111' }}>
          System Shutdown 
        </h1>
        <p style={{ margin: '0 0 8px', color: '#555', lineHeight: 1.5 }}>
          Because of the directive received from SG IT, we can't continue using the system until they provide us with their own.
        </p>
        <p style={{ margin: 0, color: '#555', lineHeight: 1.5 }}>
        Thank you for your patience, We did our Best as a Team.
        </p>
      </div>
    </div>
  );
}
