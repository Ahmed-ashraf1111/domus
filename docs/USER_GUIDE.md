# Domus User Guide

This guide explains how to use the Domus staff workspace. It is written for two roles: Admin and Agent.

Live site: https://domus-app-brown.vercel.app

Staff log in from the Workspace button in the website header. Use the language button to switch between English and Arabic, and the moon icon to switch between dark and light mode.

## What each role can do

| Area       | Admin                 | Agent                            |
| ---------- | --------------------- | -------------------------------- |
| Dashboard  | Agency-wide counts    | Own leads, visits and deals      |
| Properties | Read and write        | Read only                        |
| Leads      | All leads, can assign | Only leads assigned to the agent |
| Visits     | All visits            | Only the agent's own visits      |
| Deals      | All deals             | Only the agent's own deals       |
| Staff      | Full access           | No access                        |

## Logging in

1. Open the site and click Workspace.
2. Enter your email and password, then click Log in.
3. If the account is inactive, a message asks you to contact your administrator.

Demo accounts (for review only): admin@domus.com / Admin@123 and agent@domus.com / Agent@123.

## Dashboard

The dashboard shows counts for properties, leads, visits and deals, a chart of leads in the last 7 days, and breakdowns by stage. An Agent sees the properties of the whole agency, but only their own leads, visits and deals.

## Admin guide

### Properties

1. Open Properties from the sidebar. Use the search box and the status, purpose and type filters to find a property.
2. Click Add property to create one. Fill in the basic information, details, location and amenities, then click Save property.
3. After saving, the Images card lets you upload images (JPG, PNG or WebP, up to 4 MB each, 4 images per upload). Choose one image as the cover.
4. In the Publishing card, click Publish to show the property on the public website, or Unpublish to hide it. A property needs at least one image before publishing.
5. Use Delete property to remove a property and its images permanently. A confirmation window appears first.

The property status (available, reserved, sold, rented) also changes automatically when a deal moves to Booking or Closed won.

### Leads

1. Open Leads from the sidebar. Search by name, phone or email, and filter by stage or agent.
2. Click a lead to open its details page.
3. Assign the lead: in the Assigned agent card, choose an agent and click Assign.
4. Change the stage from the Stage card.
5. Edit the client preferences (purpose, property type, budget, preferred city, bedrooms, next follow-up) and click Save preferences.
6. Add a note or log a call in the Activity card. Every stage change, assignment and visit is also recorded there.

Every inquiry from the public website creates a lead. If the inquiry is about a property that has an agent, the lead is assigned to that agent automatically. General inquiries from the Contact page stay unassigned until an Admin assigns them.

### Best matches

On the lead details page, the Best matches card shows the three available, published properties that fit the client best. Each property gets a score out of 100 and a breakdown:

- Budget: 35 points
- City: 25 points
- Property type: 20 points
- Bedrooms: 10 points
- Purpose (sale or rent): 10 points

A preference that is left empty gives full points for that criterion. A price up to 10% above the maximum budget, or a bedroom count that differs by one, gives half points. Update the preferences and save to refresh the matches.

### Visits

1. Open Visits from the sidebar and click Schedule visit.
2. Choose the property, the agent, the date, the time and the duration. Choosing a client is optional.
3. If the agent already has a visit at that time, a warning lists the conflicting visit. You can change the time or click Schedule anyway.
4. Update a visit with Complete, Cancel or No show. Completed, cancelled and no-show visits cannot be changed again.

When a visit is linked to a client in an early stage, the lead moves to Visit scheduled automatically.

### Deals

1. Open Deals from the sidebar and click New deal.
2. Choose the property, the client (optional), the agent and the offer amount, then click Create deal.
3. Move the deal through its stages: Offer, Booking, Closed won or Closed lost.
4. Booking marks the property as Reserved. Closed won marks it as Sold or Rented and marks the lead as Converted.
5. If another deal is already booked for the same property, an Admin sees a confirmation window and can choose Continue anyway.

Closed deals cannot be edited or moved to another stage.

### Staff

1. Open Staff from the sidebar to see all staff members.
2. Click Add staff member to create an account (full name, email, phone, role and a password of at least 8 characters).
3. Use the edit button to change details. Leave the password empty to keep the current one.
4. Use Deactivate to block an account. The person is logged out on their next action and cannot log in again until the account is activated.

## Agent guide

An Agent works with their own records only.

1. Properties: browse the inventory and open any property. Agents cannot add, edit or delete properties.
2. Leads: open the leads assigned to you, add notes, log calls, update preferences and move the stage. Agents cannot assign leads to other agents.
3. Visits: schedule visits for yourself and mark them Complete, Cancel or No show. You can only link clients who are assigned to you.
4. Deals: create deals for your clients and move them through the stages. You only see your own deals.
5. Best matches: use the card on each lead to suggest properties to the client.

If you open a page or a record you are not allowed to see, you will see an Access denied page or a Not found message.

## Public website

Visitors can browse published properties, filter and sort them, open a property to see the gallery and similar properties, and send an inquiry. Each inquiry appears in Leads.
