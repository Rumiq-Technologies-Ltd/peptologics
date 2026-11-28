/**
 * User-facing copy for states and outcomes.
 *
 * Centralised so the same situation is never described two different ways, and
 * so a copy review can happen in one file rather than across thirty components.
 */

export const MESSAGES = {
  inquiry: {
    success: "Your inquiry has been received.",
    successDetail:
      "A representative will confirm availability, lot documentation, and final pricing. You will hear from us by email.",
    duplicate: "We already have this inquiry. There is no need to send it again.",
    validationFailed: "Please check the highlighted fields and try again.",
    rateLimited:
      "You have sent several inquiries recently. Please wait a few minutes before sending another.",
    emptySelection: "Add at least one product to your inquiry list before submitting.",
    unavailable:
      "One or more products on your list are no longer available. Please review your list and try again.",
    failed: "We could not submit your inquiry. Please try again, or contact us directly.",
  },

  contact: {
    success: "Your message has been sent.",
    successDetail:
      "Thank you for getting in touch. A representative will reply to the email address you gave us. A confirmation is on its way to your inbox.",
    validationFailed: "Please check the highlighted fields and try again.",
    rateLimited:
      "You have sent several messages recently. Please wait a few minutes before sending another.",
    failed: "We couldn't send your message.",
  },

  cart: {
    empty: "Your inquiry list is empty.",
    emptyDetail: "Browse the catalog and add the compounds you would like a quotation for.",
    estimateNotice:
      "Estimated subtotal. Shipping and the final total are confirmed by a representative before any transaction.",
    cleared: "Inquiry list cleared.",
    limitReached: "You have reached the maximum number of products for one inquiry.",
  },

  products: {
    empty: "No products match your search.",
    emptyDetail: "Try a different term, or clear the filters to see the full catalog.",
    loadFailed: "We could not load the catalog just now.",
    notFound: "We could not find that product.",
  },

  generic: {
    error: "Something went wrong on our end. Please try again.",
    retry: "Try again",
    loading: "Loading…",
  },
} as const;

/** Shown site-wide on staging only (D40). */
export const STAGING_BANNER_TEXT =
  "Test site: emails are switched off. Quote requests are saved but nobody is notified, and the contact form won't send. Use peptologics.com for real orders.";

/** Added to the inquiry success page when email is not configured (D40). */
export const NO_EMAIL_SENT_NOTE = "Test site: no email was sent.";
