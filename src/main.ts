import { categoryNames } from './categories.ts';
import { Client } from "https://deno.land/x/notion_sdk@v1.0.4/src/mod.ts";

const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN");
const DATABASE_1 = Deno.env.get("DATABASE_1");
const DATABASE_2 = Deno.env.get("DATABASE_2");
const DATABASE_3 = Deno.env.get("DATABASE_3");

if (!NOTION_TOKEN || !DATABASE_1 || !DATABASE_2 || !DATABASE_3) {
    throw new Error("Notion token or database IDs not found. Please, re-check the values again or write a support request to contact@notioneo.com.");
}

// Initialize a new Notion API client
const notion = new Client({
    auth: NOTION_TOKEN,
});

// Set the IDs of the two databases
const database1Id = DATABASE_1;
const database2Id = DATABASE_2;

// Set up a filter for database_1 to find RT Income and RT Expense items with empty Month relation
const database1Filter = {
  property: 'Month',
  relation: {
    is_empty: true,
  },
};

// Set up a filter for database_2 to find items with a matching Month Text formula
const database2Filter = {
  property: 'Month Text',
  formula: {
    string: {
      equals: '',
    },
  },
};

// Set up a filter for database_3 to find items with an empty Category relation
const database3Filter = {
  property: 'Category',
  relation: {
    is_empty: true,
  },
};

// Define a function to update the Month property in database_1 if it is empty
async function updateMonthPropertyIfEmpty(database1ItemId, database2ItemId) {
  const page = await notion.pages.retrieve({ page_id: database1ItemId });
  const monthRelation = page.properties.Month.relation;
  if (monthRelation.length === 0) {
    const response = await notion.pages.update({
      page_id: database1ItemId,
      properties: {
        Month: {
          type: 'relation',
          relation: [
            {
              id: database2ItemId,
            },
          ],
        },
      },
    });
    console.log(`Updated Month property for "Transactions" Database item ${database1ItemId}`);
  }
}

// Define the main function to watch database_1 and update the Month property when needed
async function watchDatabase1() {
  console.log('Watching "Transactions" Database...');
  try {
    // Make the request to the Notion API
    const response = await notion.databases.query({
      database_id: database1Id,
      filter: database1Filter,
    });

    console.log(`Found ${response.results.length} items in "Transactions" Database`);

    for (const database1Item of response.results) {
      // Get the Month Text formula from the database_1 item
      const monthTextFormula = database1Item.properties['Month Text'].formula.string;

      console.log(`Checking for matching month in "Month" Database for "Transactions" Database item ${database1Item.id}...`);

      // Update the filter for database_2 to use the Month Text formula from database_1
      database2Filter.formula.string.equals = monthTextFormula;

      // Query database_2 with the updated filter
      const response2 = await notion.databases.query({
        database_id: database2Id,
        filter: database2Filter,
      });

      if (response2.results.length > 0) {
        // Update the Month property in database_1 with the first matching database_2 item if it is empty
        await updateMonthPropertyIfEmpty(database1Item.id, response2.results[0].id);
        console.log(`Linked "Transactions" Database item ${database1Item.id} with "Month" Database item ${response2.results[0].id}.`);
      }
      else {
        console.log(`No matching month found in "Month" Database for "Transactions" Database item ${database1Item.id}.`);
      }
    }

    console.log('Done and trying again.');
  } catch (error) {
    // Handle the error
    console.error('Request to Notion API failed:', error);
  }
}

// Define a function to link categories from DATABASE_3 to DATABASE_1 based on "Name" property
async function linkCategoriesToDatabase1() {
  console.log('Linking categories from DATABASE_3 to DATABASE_1...');
  try {
    // Query DATABASE_1 to retrieve all items
    const response3 = await notion.databases.query({
      database_id: database1Id,
      filter: database3Filter,
    });

    console.log(`Found ${response3.results.length} items in DATABASE_1`);

    for (const database1Item of response3.results) {
      const itemName: string = database1Item.properties.Name.title[0].plain_text;

      if (categoryNames.includes(itemName)) {
        // Query DATABASE_3 to find the matching page based on the item name
        const database3QueryResponse = await notion.databases.query({
          database_id: DATABASE_3,
          filter: {
            property: 'Name',
            title: {
              equals: itemName,
            },
          },
        });

        if (database3QueryResponse.results.length > 0) {
          const database3ItemId = database3QueryResponse.results[0].id;

          // Link the corresponding page from DATABASE_3 to DATABASE_1
          const response31 = await notion.pages.update({
            page_id: database1Item.id,
            properties: {
              Category: {
                type: 'relation',
                relation: [
                  {
                    id: database3ItemId,
                  },
                ],
              },
            },
          });

          console.log(`Linked item ${database1Item.id} with category ${database3ItemId} in DATABASE_1`);
        }
      } else {
        console.log(`Didn't find a category with the same name for item ${database1Item.id}`);
      }
    }

    console.log('Done linking categories.');
  } catch (error) {
    // Handle the error
    console.error('Request to Notion API failed:', error);
  }
}

// Call the linkCategoriesToDatabase1() function before the watchDatabase1() function
setInterval(async () => {
  await linkCategoriesToDatabase1();
  await watchDatabase1();
}, 5000);
