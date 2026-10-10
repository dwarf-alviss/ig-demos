export const selectedConcepts = {
  cakes: "c",
  flowers: "b",
  jewelry: "b",
  fashion: "c",
};
export const conceptPath = (kind, variant) =>
  selectedConcepts[kind] === variant ? "index.html" : `concept-${variant}.html`;
