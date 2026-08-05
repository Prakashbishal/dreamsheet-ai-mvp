import React, { forwardRef } from 'react';
import type { Domain } from '../types';

interface PrintableDreamSheetProps {
  domains: Domain[];
  clientName: string;
  coachName: string;
  issuedDate: string;
  planNotes?: string;
}

const labelStyle: React.CSSProperties = {
  color: '#047857',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  marginBottom: 5,
  textTransform: 'uppercase',
};

const valueStyle: React.CSSProperties = {
  color: '#292524',
  fontSize: 13,
  lineHeight: 1.55,
  margin: 0,
  whiteSpace: 'pre-wrap',
};

const Detail = ({ label, value }: { label: string; value?: string | number }) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return (
    <div style={{ breakInside: 'avoid', marginBottom: 12 }}>
      <div style={labelStyle}>{label}</div>
      <p style={valueStyle}>{value}</p>
    </div>
  );
};

export const PrintableDreamSheet = forwardRef<HTMLDivElement, PrintableDreamSheetProps>(
  ({ domains, clientName, coachName, issuedDate, planNotes }, ref) => (
    <div
      ref={ref}
      data-dreamsheet-pdf
      style={{
        background: '#ffffff',
        boxSizing: 'border-box',
        color: '#292524',
        fontFamily: 'Arial, Helvetica, sans-serif',
        minHeight: 1123,
        padding: '44px 48px 56px',
        width: 794,
      }}
    >
      <header data-pdf-section style={{ borderBottom: '4px solid #059669', marginBottom: 28, paddingBottom: 22 }}>
        <div style={{ color: '#059669', fontSize: 12, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          DREAMsheet AI
        </div>
        <h1 style={{ color: '#1c1917', fontSize: 34, lineHeight: 1.1, margin: '10px 0 20px' }}>
          Strategic Plan
        </h1>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Detail label="Coachee" value={clientName || 'Not specified'} />
          <Detail label="Coach" value={coachName || 'AI Coach'} />
          <Detail label="Issued" value={issuedDate} />
        </div>
      </header>

      {domains.length > 0 && (
        <section data-pdf-section style={{ breakInside: 'avoid', marginBottom: 30 }}>
          <h2 style={{ color: '#1c1917', fontSize: 22, margin: '0 0 14px' }}>Consolidated Roadmap</h2>
          <div style={{ border: '1px solid #d6d3d1', borderRadius: 10, overflow: 'hidden' }}>
            {domains.flatMap((domain) => domain.subAreas.map((sub) => ({ domain, sub }))).map(({ domain, sub }, index) => (
              <div
                key={`${domain.id}-${sub.id}`}
                style={{
                  background: index % 2 === 0 ? '#f5f5f4' : '#ffffff',
                  borderTop: index === 0 ? 'none' : '1px solid #e7e5e4',
                  display: 'grid',
                  gap: 10,
                  gridTemplateColumns: '1.15fr 1.8fr 1fr',
                  padding: '11px 14px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800 }}>{domain.name}</div>
                <div style={{ fontSize: 11 }}>{sub.goal || sub.name}</div>
                <div style={{ color: '#57534e', fontSize: 10 }}>
                  {sub.startDate || 'TBD'} – {sub.isOngoing ? 'Ongoing' : (sub.finishDate || sub.targetDate || 'TBD')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {domains.map((domain, domainIndex) => (
        <section key={domain.id} data-pdf-section style={{ marginBottom: 34 }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: 12, marginBottom: 14 }}>
            <span style={{ alignItems: 'center', background: '#1c1917', borderRadius: 20, color: '#fff', display: 'flex', fontSize: 14, fontWeight: 800, height: 32, justifyContent: 'center', width: 32 }}>
              {domainIndex + 1}
            </span>
            <h2 style={{ color: '#1c1917', fontSize: 24, margin: 0 }}>{domain.name}</h2>
          </div>

          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, marginBottom: 18, padding: 16 }}>
            <Detail label="Domain vision" value={domain.domainVision || domain.vision} />
            <Detail label="Why this matters" value={domain.why} />
            <Detail label="Domain goal" value={domain.domainGoal} />
            <Detail label="Domain affirmation" value={domain.domainAffirmation} />
            {(domain.currentRating || domain.futureRating || domain.importance || domain.urgency) && (
              <p style={{ ...valueStyle, color: '#57534e', fontSize: 11 }}>
                {domain.currentRating ? `Current rating: ${domain.currentRating}/10` : ''}
                {domain.futureRating ? `  Future rating: ${domain.futureRating}/10` : ''}
                {domain.importance ? `  Importance: ${domain.importance}/10` : ''}
                {domain.urgency ? `  Urgency: ${domain.urgency}/10` : ''}
              </p>
            )}
          </div>

          {domain.subAreas.map((sub, subIndex) => (
            <article key={sub.id} data-pdf-section style={{ border: '1px solid #d6d3d1', borderRadius: 12, breakInside: 'avoid', marginBottom: 18, padding: 18 }}>
              <div style={{ color: '#78716c', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Focus area {subIndex + 1}
              </div>
              <h3 style={{ color: '#1c1917', fontSize: 19, margin: '6px 0 15px' }}>{sub.name}</h3>
              <Detail label="End goal" value={sub.goal} />
              <Detail label="Timeline" value={`${sub.startDate || 'TBD'} – ${sub.isOngoing ? 'Ongoing' : (sub.finishDate || sub.targetDate || 'TBD')}`} />
              <Detail label="Success indicator" value={sub.successIndicator} />
              {sub.milestones && sub.milestones.length > 0 && <Detail label="Milestones" value={sub.milestones.map((item, i) => `${i + 1}. ${item}`).join('\n')} />}
              <Detail label="Affirmation" value={sub.affirmation} />

              {sub.obstacles && sub.obstacles.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={labelStyle}>Obstacles and strategies</div>
                  {sub.obstacles.map((item, index) => (
                    <div key={index} style={{ background: '#fafaf9', borderLeft: '3px solid #059669', breakInside: 'avoid', marginBottom: 8, padding: '9px 12px' }}>
                      <Detail label="Obstacle" value={item.obstacle} />
                      <Detail label="Overcome" value={item.solution} />
                    </div>
                  ))}
                </div>
              )}

              {sub.actionSteps && sub.actionSteps.length > 0 && (
                <div style={{ marginTop: 15 }}>
                  <div style={labelStyle}>Action steps</div>
                  {sub.actionSteps.map((step, index) => (
                    <div key={index} style={{ background: '#f5f5f4', borderRadius: 8, breakInside: 'avoid', marginBottom: 10, padding: 13 }}>
                      <h4 style={{ fontSize: 13, margin: '0 0 9px' }}>{index + 1}. {step.task}</h4>
                      <Detail label="Dates" value={`${step.startDate || step.dueDate || 'TBD'} – ${step.isOngoing ? 'Ongoing' : (step.endDate || step.dueDate || 'TBD')}`} />
                      <Detail label="Measure" value={step.measure} />
                      <Detail label="Obstacle" value={step.obstacle} />
                      <Detail label="Overcome / solution" value={step.overcome} />
                      <Detail label="Contingency" value={step.contingency} />
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}

          <Detail label="Domain notes" value={domain.notes} />
        </section>
      ))}

      {planNotes && (
        <section data-pdf-section style={{ background: '#1c1917', borderRadius: 12, color: '#fff', padding: 22 }}>
          <div style={{ ...labelStyle, color: '#6ee7b7' }}>Strategic synthesis</div>
          <p style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{planNotes}</p>
        </section>
      )}
    </div>
  ),
);

PrintableDreamSheet.displayName = 'PrintableDreamSheet';
