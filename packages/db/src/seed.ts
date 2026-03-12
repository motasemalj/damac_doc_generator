import { PrismaClient } from '@prisma/client';
import { DEFAULT_DAMAC_TEMPLATE, getDefaultSections } from '../../core/src/default-template';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const existingDefault = await prisma.template.findFirst({ where: { isDefault: true } });
  if (!existingDefault) {
    await prisma.template.create({
      data: {
        name: 'DAMAC Enterprise TDD',
        description:
          'Comprehensive Technical Design Document template for enterprise systems. Generates publication-quality documentation with architecture diagrams, API specifications, and deployment details.',
        promptText: DEFAULT_DAMAC_TEMPLATE,
        variablesSchema: JSON.stringify([
          {
            name: 'OPTIONAL_NOTES',
            label: 'Optional Notes',
            description: 'Additional notes to append to the generation prompt',
            required: false,
            defaultValue: '',
          },
        ]),
        sectionsSchema: JSON.stringify(getDefaultSections()),
        isDefault: true,
      },
    });
    console.log('Created default DAMAC template');
  } else {
    await prisma.template.update({
      where: { id: existingDefault.id },
      data: {
        promptText: DEFAULT_DAMAC_TEMPLATE,
        sectionsSchema: JSON.stringify(getDefaultSections()),
      },
    });
    console.log('Updated default template with sections');
  }

  const simpleTemplate = await prisma.template.findFirst({
    where: { name: 'Quick Overview TDD' },
  });
  if (!simpleTemplate) {
    await prisma.template.create({
      data: {
        name: 'Quick Overview TDD',
        description: 'A lighter TDD template focused on high-level architecture and key endpoints.',
        promptText: `Generate a concise Technical Design Document for the target system based on the provided codebase.

Focus on:
1. Executive Summary (2-3 paragraphs)
2. Architecture Overview with a Mermaid component diagram
3. Key API Endpoints (top 10 most important)
4. Data Model with a Mermaid ER diagram
5. Configuration and Environment Variables

Keep it professional but concise. Use Mermaid diagrams where helpful.
Number all figures sequentially.

{{OPTIONAL_NOTES}}`,
        variablesSchema: JSON.stringify([
          {
            name: 'OPTIONAL_NOTES',
            label: 'Optional Notes',
            required: false,
            defaultValue: '',
          },
        ]),
        sectionsSchema: JSON.stringify([]),
        isDefault: false,
      },
    });
    console.log('Created Quick Overview template');
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
