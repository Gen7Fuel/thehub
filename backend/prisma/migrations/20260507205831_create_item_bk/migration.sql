-- CreateTable
CREATE TABLE "item_bk" (
    "id" SERIAL NOT NULL,
    "upc" TEXT NOT NULL,
    "gtin" TEXT,
    "description" TEXT,
    "syncDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_bk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_bk_upc_key" ON "item_bk"("upc");
