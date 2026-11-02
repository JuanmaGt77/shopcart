/* =============================================================================
   ShopCart · 000 · Creación de la base de datos
   -----------------------------------------------------------------------------
   Crea la base desde cero. Este script BORRA la base si ya existe, por eso los
   runners (run-all.sh / run-all.ps1 / npm run db:setup) solo lo ejecutan cuando
   la base no existe o cuando se pide explícitamente --reset.

   Decisiones:
   - Collation Modern_Spanish_CI_AI: ordena bien la ñ y las búsquedas no
     distinguen mayúsculas ni tildes ("cancion" encuentra "canción").
   - Nivel de compatibilidad 150 (SQL Server 2019), que es el mínimo que pide
     el reto. Así me aseguro de no depender de algo exclusivo de 2022.
   - READ_COMMITTED_SNAPSHOT: las lecturas (catálogo, reportes) no se bloquean
     con las escrituras del checkout. Las validaciones críticas usan UPDLOCK o
     UPDATE condicionales, así que el versionado no afecta la concurrencia.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
USE master;
GO

IF DB_ID(N'$(DBName)') IS NOT NULL
BEGIN
    ALTER DATABASE [$(DBName)] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$(DBName)];
END
GO

CREATE DATABASE [$(DBName)] COLLATE Modern_Spanish_CI_AI;
GO

ALTER DATABASE [$(DBName)] SET COMPATIBILITY_LEVEL = 150;
ALTER DATABASE [$(DBName)] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
ALTER DATABASE [$(DBName)] SET RECOVERY SIMPLE;
GO
