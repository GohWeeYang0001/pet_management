import type { BookingIssue } from "../../utils/bookingValidation";

export function FieldValidation({field,issues}:{field:string;issues:BookingIssue[]}) {
    const issue=issues.find(issue=>issue.field===field);
    return issue?<p id={`validation-${field}`} className="form-error field-validation">{issue.message}</p>:null;
}
export function ValidationSummary({issues}:{issues:BookingIssue[]}) {
    return issues.length?<div className="booking-validation-summary" role="alert"><strong>{issues.every(issue=>issue.missing)?"请完成以下必填项：":"请检查以下项目："}</strong>
        <ul>{issues.map(issue=><li key={issue.field}>{issue.label}{!issue.missing?`：${issue.message}`:""}</li>)}</ul></div>:null;
}
