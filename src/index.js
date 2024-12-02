export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/create-subscription") {
            return await createSubscription(request, env);
        }
        return new Response("Not Found", { status: 404 });
    },
};

async function createSubscription(request, env) {
    const { customerId, amount } = await request.json();
    const response = await fetch("https://api.stripe.com/v1/subscriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            customer: customerId,
            items: JSON.stringify([{ price_data: { currency: "usd", unit_amount: amount * 100 } }]),
        }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
