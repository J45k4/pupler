# Pupler

Puppy butler service.

## Feature

### Manage food items

When new food items are added store metdata to it to database like expiration date and links to foods.

### Manage food recepies 

Collect list of good receipts that household likes and what food items these receipts need and how much.

Use this information to automatically generate food menu. Try to optimize food menu so that incredients can be shared as much of possible.

### Manage items

Manage what items there are when they are bought and their receipts.

### Shoppinglist

Automaticaly generate shoppinglists for based of menu like what items are needed also consider expiration dates of food items.

## Data

### Item

- name
- addedAt

### Shoppinglist item

- name
- done
- 

### Receipt

### Menu item

- title
- description
- foodType (breakfast | lunch | dinner | even snack)

### Incredients

- name
- 

### Recipe

- name
- description
- incredientId
- quantity
- quantityUnit

## Interfaces

### Web UI

### Embended

Some raspberry pi level device for viewing recepies or timers in the kitchen. Should be optimized for low input needs.

### CLI

Primary for agents for for humans too if they want. Manage things and search for this you know...