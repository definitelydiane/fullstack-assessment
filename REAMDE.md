# Fixing unconfigured host for images
There are several images that use the url `https://images-na.ssl-images-amazon.com`
which is not configured in the `next.config.ts` file (for example https://images-na.ssl-images-amazon.com/images/I/81ZSuzkKKHL._AC_SL1500_.jpg). Next will not serve
images from this domain and so the application will throw an unhandled exception on
the product pages, or if any of these product SKUs show up in the results: `9P4530G4`, `633PVJ64`, `6ED887YG`, and `DDX03Q0G`.

To fix this, we can add this domain to the `images.remotePatterns` array in the
`next.config.ts` like so:

```js
remotePatterns: [
	{
		protocol: 'https',
		hostname: 'm.media-amazon.com',
	},
	{
		protocol: 'https',
		hostname: 'images-na.ssl-images-amazon.com',
	,}
],
```

# Fixing JSON passed as query param
This poses a lot of problems.

In terms of security, a malicious actor could create a fake product page that
*looks* like it's authored by us by sending in arbitrary JSON. A malicious actor
could also create fake product pages in this same way. If we had a buy button on
our product pages, a user could be easily misled into buying something they didn't
intend for.

In terms of UX, the created URL is not easily readable or user friendly. It's likely
that users will be disinclined to click on our URL. We want users to look at our URLs
and get the gist that this is a page for a specific product.

We also won't be able to pre-render this page, since all of its contents are updated
client side. That happens fast enough for our users to not notice, but search engines
will be unable to crawl our product pages to display as search results since the page
will be empty on the initial page load. That means we are going to lose valuable traffic.

## Proposed solution
Instead of passing the product to this page as a query parameter, let's simply use the
URL to point to the *resource* identified by the SKU. We want our user to be able to
pass `https://www.our-site.com/products/[sku]` into their browser and pull up the relevant
page. Our API already supports this, so we can use this same endpoint.

### A note on optimization
The data on the page is static; we can use a Server Component to pre-render and cache this page.
Next.js does this for us [automatically](https://nextjs.org/docs/15/app/guides/caching#overview)
once we remove the `'use client'` directive. This is great because our pages will
be served as fast as possible, and we'll have content immediately available to search engines.

### Implementation
We can create dynamic routes, i.e. `https://www.our-site.com/product/[sku]`, by
moving `products/page.tsx` to `products/[sku]/page.tsx`.

We no longer need a `fetch` call in a `useEffect` hook, since our data retrieval will be handled server-side.
Since our component will be rendered on the server, we can be free to use `productService` here instead
of using `fetch` to call our own REST API.

There is one stateful piece in our puzzle: the image carousel. I'll move this into
it's own component in `components/ui/imageCarousel.tsx` so we can have a `useState`
hook to keep track of what image the user is looking at.

We'll then need to update all of the links from our product list page `/` to use our
new URL scheme.

### Notes on testing the solution 
In an ideal situation, when implementing a change like this, we would want to use
snapshot testing to ensure that the page contents remain the same.

# Improving subcategory UI
When looking at a category, for example `Bed Pillows & Pillowcases`, the subcategories
dropdown contains a list of all possible subcategories. That means that a user's options for
subcategories include non-relevant things like `Air Mattressses`, and if a user selects
this, then we will yield zero results. We only want to list the possible subcategories
of our main category to avoid this.

Fortunately our REST API endpoint already has this functionality. So all we need to do is update
the `fetch` request to pass in the `selectedCategory` as a query param.

I first tried this:
```js
fetch(`/api/subcategories?category=${selectedCategory}`)
```
which ended up introducing a bug, that being categories with spaces would break the
request. Ideally we'd prefer to pass in a `categoryId` here instead of the string name
of a category, but since that would require refactoring the API a bit, we can just
use `URLSearchParams` to safely encode it.

# Telling users how many products we have
Right now we only have text that says something like `Showing 20 products`. This leaves users either
a) assuming we only have 20 products total or b) wondering how many products we have to display.

Our API returns the total number of products, so we can easily use this to display that additional
information to our users to let them know we have lots of products to view. We'll need to introduce
a variable to keep track of this:
```js
const [totalProducts, setTotalProducts] = useState<number>(0);
```
and update it in our `useEffect` hook that runs runs our ``fetch(`/api/products?{params}`)`` request.

# Clearing filters does not reset the dropdown to default
When we hit "clear filters", it looks like we're still filtering our products because the dropdown does
not reset to its placeholder value of `All Categories`. We can reset this by changing
`setSelectedCategory(undefined)` to `setSelectedCategory("")` on the `onClick` handler for the `Clear Filters`
button. We'll do the same for the `selectedSubCategory`.

# Notes and Things I didn't get to addressing

## Changing a category does not immediately clear the subcategory
I believe this is a bug I introduced from clearing the filter dropdowns.

If we are filtering our results, say Tablets>E-Readers and we change our category in the UI to
`Baby Skin & Hair Care` then the products will not update correctly and show a "No products found"
page.

My intuition is that we are updating several bits of state when we click `Clear Filters`.
However, because these are all separate hooks that make their own API calls, the promises
may not resolve in a way we expect.

I would address this one of two ways:
1. Most immediately, we could combine `search`, `selectedCategory`, and `selectedSubCategory`
into a `searchFilters` object. i.e
```js
const [searchFilters, setSearchFitlers] = useState({
	search: "",
	category: "",
	subCategory: ""
	})
```
That would make it much easier to refactor our multiple `useEffect` hooks.

2. We can follow the same idea as I did on the product pages; we can use the URL to point to
categories and subcategories e.g. `https//www.our-site.com/products/[category]/[subCategory]`.
But this is a relatively large change, including in the way we have our pages laid out and might affect the UX
patterns we'd like to be able to use.

## Pagination
Right now we have no way of moving past the first page of results. Our API supports this through
the `offset` query parameter for `/api/products`. We can use this to display more results on the page.

## Debouncing user input to search bar
Right now any time a user presses a button, the product list changes immediately. This has the UX
problem of the results page flickering as the user types, and it also means we send a lot of queries
to our API that we don't actually need to send.

We can do this by debouncing our search query until after the user has stopped typing for some duration,
by some fractions of a second (e.g. 200ms). That will reduce the load on our servers (by not sending a new
query each time we enter a new character) and the page won't flicker until after the search query is
fully typed in.

## Caching the data on the products page
We can use server components to pre-render a significant amount of the product pages.
These pages have mostly static data, with little interactivity. The main things we
are using interactivity for as it stands is querying and filtering results. I used
this approach to optimize the product pages themselves, and we can take a similar
approach to these product pages.
