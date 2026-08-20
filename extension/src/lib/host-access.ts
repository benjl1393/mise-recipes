// The optional host access the recipe pulse needs, in one place.
//
// Three call sites have to agree — the manifest's `optional_host_permissions`,
// the `chrome.permissions` calls in Prep, and the `matches` on the dynamically
// registered detector. When they drift, `request()` fails silently, which is
// exactly the failure that is expensive to diagnose.
//
// Why not `<all_urls>`: it also spans file:// and ftp://, which are not things
// Mise wants and not things Chrome will hand over from a runtime prompt. Every
// Chrome example for runtime host requests uses the scheme-wildcard form below,
// so that is what this asks for. Recipe pages are http(s) by definition.
//
// Note these patterns are written with line comments on purpose: the wildcard
// form contains the characters that close a block comment.

export const HOST_MATCHES = ["https://*/*", "http://*/*"] as const;

/** The same set shaped for the `chrome.permissions` API. */
export const HOST_ACCESS: chrome.permissions.Permissions = {
  origins: [...HOST_MATCHES],
};
