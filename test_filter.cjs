
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kjebadvveghiahmiqnin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZWJhZHZ2ZWdoaWFobWlxbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjAxNTcsImV4cCI6MjA4NTg5NjE1N30.7GjIWOg_Ow9nLscnEY5fqVez2kBcF4PTRT9MO0LwKzE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFilter() {
    console.log("Testing filter with .neq('category', 'ARCHIVED')...");

    // Fetch specifically for Abidjan
    const { data: abidjanData, error: abidjanError } = await supabase
        .from('products')
        .select('*')
        .eq('site', 'abidjan')
        .neq('category', 'ARCHIVED');

    if (abidjanError) {
        console.log("Error Abidjan:", abidjanError);
    } else {
        console.log(`Abidjan filtered count: ${abidjanData.length}`);
        abidjanData.forEach(p => console.log(` - ${p.name} [${p.category}]`));
    }

    // Fetch specifically for Bassam
    const { data: bassamData, error: bassamError } = await supabase
        .from('products')
        .select('*')
        .eq('site', 'bassam')
        .neq('category', 'ARCHIVED');

    if (bassamError) {
        console.log("Error Bassam:", bassamError);
    } else {
        console.log(`Bassam filtered count: ${bassamData.length}`);
        bassamData.forEach(p => console.log(` - ${p.name} [${p.category}]`));
    }

    // Check what exact string is in category for archived ones
    const { data: rawData } = await supabase
        .from('products')
        .select('category')
        .eq('site', 'abidjan');

    console.log("Raw categories in Abidjan:");
    rawData.forEach((p, i) => console.log(`${i}: '${p.category}' (len: ${p.category.length})`));
}

testFilter();
