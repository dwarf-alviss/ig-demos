# Tier groups, lily insertion and wafer seating

Current production bundle: c608b93efcfa8fd79b7b993ff1effaf61f92f5e11658a505a2b596b2afaba970.

Lower tier decorations search small asymmetric groups on the usable ledge, using each ingredient footprint and actual polygon boundaries. Food orientation uses the final seated position. Long wafer rolls lie on their side on tier roofs, retain the supplied diameter, and check their full length against the roof and nearby decoration; capsule collisions include crossed rods and berries near their ends. Plate/pastry placement remains separately calibrated.

Basket stalk insertion and support radius are smaller. Lilies receive three narrow leaves higher along their own curved stalks, bounded by the basket mouth. Count-aware basket sizing and original flower dimensions are preserved.

Validation: the full 74-test suite passed. After adding one collision regression, all five composition tests passed again without a production change. The native basket core/finiteness probe passed 567 cases. Personally inspected 89 configurations in four views (55 native cakes, 29 native baskets, 2 recipe cakes, 3 recipe baskets). Three browser interface checks and six export checks passed on this bundle. The first interface run timed out on a repeated cart action; the full retry passed, but its original cause remains unconfirmed.

Acceptance is incomplete: some sparse lily baskets expose inner stalk/support; limited-quantity cakes can still look sparse. This is a checkpoint with improvements and recorded defects, not a claim that every combination is ideal.
