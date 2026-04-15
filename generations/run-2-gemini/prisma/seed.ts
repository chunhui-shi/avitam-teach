import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: "intro-to-javascript" },
    update: {},
    create: {
      title: "Introduction to JavaScript",
      slug: "intro-to-javascript",
      description: "Learn the basics of JavaScript programming.",
      price: 29.99,
      isPublished: true,
      lessons: {
        create: [
          {
            title: "What is JavaScript?",
            slug: "what-is-js",
            content: "JavaScript is a versatile programming language used for web development.",
            order: 1,
            type: "TEXT",
          },
          {
            title: "Variables Quiz",
            slug: "variables-quiz",
            order: 2,
            type: "MCQ",
            mcq: {
              create: {
                question: "Which keyword is used to declare a variable that cannot be reassigned?",
                options: ["var", "let", "const", "def"],
                correctIndex: 2,
              },
            },
          },
          {
            title: "Hello World Exercise",
            slug: "hello-world",
            order: 3,
            type: "CODE",
            codeExercise: {
              create: {
                starterCode: "function hello() {\n  // return 'Hello World'\n}",
                testCode: "assert(hello() === 'Hello World')",
                solution: "function hello() {\n  return 'Hello World'\n}",
              },
            },
          },
        ],
      },
    },
  });

  console.log({ course });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
