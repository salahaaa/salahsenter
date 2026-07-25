/**
 * Service Layer — public barrel
 *
 * Routes/pages import business logic from HERE, never from `lib/db` directly.
 * Each service owns a domain and embeds authorization/ownership checks so the
 * data-access boundary is enforced in one place.
 */

export * as productService from "./product.service";
export * as orderService from "./order.service";
export * as storeService from "./store.service";
export * as merchantService from "./merchant.service";
export * as mediaService from "./media.service";
