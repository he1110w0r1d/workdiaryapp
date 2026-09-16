import React from 'react';
export default function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="page-heading">
    <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="heading-actions">{actions}</div>}
  </div>;
}
