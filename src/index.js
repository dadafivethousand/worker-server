async function createSubscription(request, env) {
    const { kids } = await request.json();

    // Validate the input
    if (!Array.isArray(kids) || kids.length === 0) {
        return new Response("Invalid input", { status: 400 });
    }

    try {
        // Pricing logic (securely calculated on the backend)
        const basePrice = 100; // Base price per person
        const totalPrice = kids.reduce((total, _, index) => {
            if (index === 0) return total + basePrice; // Full price for the first member
            return total + basePrice * (1 - 0.2 * index); // 20% off per additional member
        }, 0);

        // Create the subscription in Stripe
        const response = await fetch("https://api.stripe.com/v1/subscriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                "items[0][price_data][currency]": "usd",
                "items[0][price_data][product]": "prod_ABC123", // Replace with your product ID
                "items[0][price_data][unit_amount]": Math.round(totalPrice * 100), // Total price in cents
            }),
        });

        const data = await response.json();

        // Handle Stripe's response
        if (!response.ok) throw new Error(data.error?.message || "Stripe subscription failed");

        // Send the subscription checkout URL to the frontend
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error('Error creating subscription:', error);
        return new Response("Failed to create subscription", { status: 500 });
    }
}
