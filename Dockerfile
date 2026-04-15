# Use official, lightweight Node baseline 
FROM node:20-alpine

# Establish directory mapping
WORKDIR /usr/src/app

# Only copy dependency logs first for maximized docker cache utilization
COPY package*.json ./

# Install all dependencies including devDependencies for tsc
RUN npm install

# Copy application layers
COPY . .

# Compile TypeScript
RUN npm run build

# Render injects PORT at runtime — do not hardcode
# EXPOSE is informational only; the app reads process.env.PORT
EXPOSE 10000

# Execute the native Node bootstrap script
CMD [ "npm", "start" ]
